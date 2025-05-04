import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import * as ExcelJS from "exceljs"
import { v4 as uuidv4 } from "uuid"
import { connectToDatabase } from "@/lib/mongodb"
import { checkCodesAgainstGoogleSheet, getAllCodesCount } from "@/lib/google-sheets"


const memoryStorage = new Map()

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const selectedOrtsJson = formData.get("selectedOrts")
    


    if (!file || !selectedOrtsJson) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
        },
        { status: 400 },
      )
    }

    const selectedOrts = JSON.parse(selectedOrtsJson)


    // Save the file temporarily
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)


    // Connect to MongoDB
    const { db } = await connectToDatabase()
    
    // Get necessary data from MongoDB
    const [exclusions, manualAbbreviations, orderReplacements, rules] = await Promise.all([
      db.collection("exclusions").find({}).toArray(),
      db.collection("manual_abbreviations").find({}).toArray(),
      db.collection("order_replacements").find({}).toArray(),
      db.collection("rules").find({ isActive: true }).sort({ priority: 1 }).toArray(),
    ])

    // Process the Excel file
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]

    // Map column headers
    const headerRow = worksheet.getRow(1)
    const columnMap = {}

    headerRow.eachCell((cell, colNumber) => {
      const columnName = cell.value?.toString().trim()
      if (columnName) columnMap[columnName] = colNumber
    })

    // Check required columns
    const requiredColumns = ["Anlage", "Funktion", "Ort", "BMK", "Hersteller", "Bestell_Nr_", "Teilemenge"]
    const missingColumns = requiredColumns.filter((col) => !columnMap[col])

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Excel dosyasında gerekli sütunlar bulunamadı: ${missingColumns.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // Process worksheet data
    const { ortGroups, invalidRows } = processWorksheetData(
      worksheet,
      columnMap,
      selectedOrts,
      rules,
      exclusions.map((e) => e.orderNumber),
      manualAbbreviations,
      orderReplacements,
    )

    // Tüm kodları topla ve her zaman Google Sheets kontrolü yap
    let codeCheckResult = { success: true }
    try {
      const allCodes = []
      Object.values(ortGroups).forEach((group) => {
        group.forEach((item) => allCodes.push(item.Kod))
      })

      // Google Sheet'te kontrol et - artık koşul olmadan her zaman çalışacak
      codeCheckResult = await checkCodesAgainstGoogleSheet(allCodes)

      // Kimlik bilgileri hatası varsa kullanıcıya bildir ama işleme devam et
      if (codeCheckResult.credentialsError) {
        console.warn("Google Sheets kimlik bilgileri bulunamadı. Kod kontrolü yapılamadı.")
      }
    } catch (error) {
      console.error("Kod kontrol hatası:", error)
      codeCheckResult = {
        success: false,
        error: "Kod kontrolü yapılırken bir hata oluştu, ancak Excel işleme devam ediyor.",
      }
    }

    // Generate output file
    const outputFileId = uuidv4()

    const outputWorkbook = await generateOutputFile(ortGroups, invalidRows, codeCheckResult)

        // Excel dosyasını bellek içinde buffer'a dönüştür
        const outputBuffer = await outputWorkbook.xlsx.writeBuffer()

        // Bellek depolama alanına kaydet
        memoryStorage.set(outputFileId, {
          buffer: outputBuffer,
          timestamp: Date.now(),
          filename: "processed_output.xlsx",
        })
    
        // 1 saat sonra otomatik temizleme
        setTimeout(() => {
          if (memoryStorage.has(outputFileId)) {
            memoryStorage.delete(outputFileId)
            console.log(`Deleted expired file: ${outputFileId}`)
          }
        }, 3600000) // 1 saat = 3600000 ms



    return NextResponse.json({
      success: true,
      fileId: outputFileId,
      codeCheck: codeCheckResult,
    })
  } catch (error) {
    console.error("Error processing Excel file:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process Excel file",
      },
      { status: 500 },
    )
  }
}

// Helper function to process worksheet data
function processWorksheetData(
  worksheet,
  columnMap,
  selectedOrts,
  rules,
  excludedNumbers = [],
  manualAbbreviations = [],
  orderReplacements = [],
) {
  const ortGroups = {}
  const invalidRows = []

  selectedOrts.forEach((ort) => (ortGroups[ort] = []))

  // Process rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber)
    const ortValue = row.getCell(columnMap["Ort"])?.value?.toString().trim()

    if (!ortValue || !selectedOrts.includes(ortValue)) continue

    const result = processRow(row, columnMap, rules, excludedNumbers, manualAbbreviations, orderReplacements)

    if (result?.type === "valid") {
      ortGroups[ortValue].push(result.data)
    } else if (result?.type === "invalid") {
      invalidRows.push(result.data)
    }
  }

  return { ortGroups, invalidRows }
}

// Helper function to process a single row
function processRow(row, columnMap, rules, excludedNumbers = [], manualAbbreviations = [], orderReplacements = []) {
  const getCellValue = (colName) => {
    const colNum = columnMap[colName]
    return colNum ? row.getCell(colNum).value?.toString().trim() || "" : ""
  }

  const originalBestellNr = getCellValue("Bestell_Nr_")
  const hersteller = getCellValue("Hersteller")

  // Check for manual abbreviation
  const manualAbbr = manualAbbreviations.find(
    (item) => item.orderNumber.toLowerCase() === originalBestellNr.toLowerCase(),
  )

  // Check for order replacement
  let finalNr = originalBestellNr
  const replacement = orderReplacements.find(
    (item) => item.originalOrderNumber.trim().toLowerCase() === originalBestellNr.trim().toLowerCase(),
  )

  if (replacement) {
    finalNr = applyRules(replacement.replacementOrderNumber, rules, true)
  } else {
    finalNr = applyRules(originalBestellNr, rules)
  }

  // If manual abbreviation exists
  if (manualAbbr) {
    const anlage = getCellValue("Anlage")
    const funktion = getCellValue("Funktion")
    const ort = getCellValue("Ort")
    const bmk = getCellValue("BMK")
    const teilemenge = Number.parseInt(getCellValue("Teilemenge")) || 1

    const etiket = `${anlage}${funktion}${ort}${bmk}`.trim()

    return {
      type: "valid",
      data: {
        Etiket: etiket,
        Kod: `${manualAbbr.abbreviation}.${finalNr}`,
        Adet: teilemenge,
        Ort: ort,
      },
    }
  }

  // Check for missing fields
  const missingFields = []
  if (!hersteller) missingFields.push("Hersteller")
  if (!originalBestellNr) missingFields.push("Bestell_Nr_")

  if (missingFields.length > 0) {
    return {
      type: "invalid",
      data: {
        rowNumber: row.number,
        Anlage: getCellValue("Anlage"),
        Funktion: getCellValue("Funktion"),
        Ort: getCellValue("Ort"),
        BMK: getCellValue("BMK"),
        Hersteller: hersteller,
        Bestell_Nr_: originalBestellNr,
        Teilemenge: getCellValue("Teilemenge"),
        missingFields: missingFields.join(", "),
      },
    }
  }

  // Check exclusions
  if (originalBestellNr && Array.isArray(excludedNumbers)) {
    const normalizedExcluded = excludedNumbers.map((n) => n?.toString().trim().toLowerCase())
    if (normalizedExcluded.includes(originalBestellNr.toLowerCase())) {
      return null
    }
  }

  // Get other values
  const anlage = getCellValue("Anlage")
  const funktion = getCellValue("Funktion")
  const ort = getCellValue("Ort")
  const bmk = getCellValue("BMK")
  const teilemenge = Number.parseInt(getCellValue("Teilemenge")) || 1

  // Create label
  const etiket = `${anlage}${funktion}${ort}${bmk}`.trim()

  // Process code
  const kod = finalNr
  const abbreviation = getManufacturerAbbreviation(hersteller)

  return {
    type: "valid",
    data: {
      Etiket: etiket,
      Kod: abbreviation ? `${abbreviation}.${kod}` : kod,
      Adet: teilemenge,
      Ort: ort,
    },
  }
}

// Helper function to apply rules
function applyRules(bestellNr, rules, isReplaced = false) {
  if (typeof bestellNr !== "string" || !bestellNr.trim()) {
    return bestellNr || ""
  }

  const trimmedNr = bestellNr.trim()

  if (isReplaced) {
    return trimmedNr
  }

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.regexPattern)
      const match = trimmedNr.match(regex)
      if (match) {
        const model = (match[1] || "").replace(/\./g, "")
        const formatted = rule.outputFormat.replace("{model}", model)
        return formatted
      }
    } catch (error) {
      console.error("Rule processing error:", error)
    }
  }

  return trimmedNr
}

// Helper function to get manufacturer abbreviation
function getManufacturerAbbreviation(manufacturer) {
  const manufacturerLower = manufacturer?.toLowerCase() || ""

  if (manufacturerLower.includes("rittal")) return "RIT"
  if (manufacturerLower.includes("siemens")) return "SIE"
  if (manufacturerLower.includes("wöhner")) return "WOE"
  if (manufacturerLower.includes("lenze")) return "LEN"
  if (manufacturerLower.includes("eta")) return "ETA"
  if (manufacturerLower.includes("lütze")) return "LUE"
  if (manufacturerLower.includes("harting")) return "HAR"
  if (manufacturerLower.includes("festo")) return "FES"
  if (manufacturerLower.includes("lapp")) return "LAPP"
  if (manufacturerLower.includes("phoenix")) return "PXC"
  if (manufacturerLower.includes("schmersal")) return "SCHM"
  if (manufacturerLower.includes("helukabel")) return "HELU"
  if (manufacturerLower.includes("weidmüller")) return "WEI"
  if (manufacturerLower.includes("murrelektr")) return "MURR"
  if (manufacturerLower.includes("jumo")) return "JUMO"
  if (manufacturerLower.includes("pepperl&fu")) return "P+F"
  if (manufacturerLower.includes("neutrik")) return "NEU"
  if (manufacturerLower.includes("block")) return "BLO"
  if (manufacturerLower.includes("eaton")) return "ETN"
  if (manufacturerLower.includes("siba")) return "SIBA"

  return ""
}

// Helper function to generate output file
async function generateOutputFile(ortGroups, invalidRows = [], codeCheckResult = {}) {
  const outputWorkbook = new ExcelJS.Workbook()

  // Main sheet
  const mainSheet = outputWorkbook.addWorksheet("Tüm Veriler")
  mainSheet.columns = [
    { header: "Etiket", key: "Etiket", width: 30 },
    { header: "Kod", key: "Kod", width: 25 },
    { header: "Adet", key: "Adet", width: 10 },
    { header: "Ort", key: "Ort", width: 10 },
  ]

  // Sheets for Ort groups
  Object.entries(ortGroups).forEach(([ortValue, rows]) => {
    if (rows.length > 0) {
      const sheetName = ortValue.length > 31 ? ortValue.substring(0, 28) + "..." : ortValue
      const ortSheet = outputWorkbook.addWorksheet(sheetName)
      ortSheet.columns = [...mainSheet.columns]

      rows.forEach((row) => {
        mainSheet.addRow(row)
        ortSheet.addRow(row)
      })
    }
  })

  // Sheet for invalid rows
  if (invalidRows.length > 0) {
    const invalidSheet = outputWorkbook.addWorksheet("Geçersiz Satırlar")
    invalidSheet.columns = [
      { header: "Satır No", key: "rowNumber", width: 10 },
      { header: "Eksik Alanlar", key: "missingFields", width: 20 },
      { header: "Anlage", key: "Anlage", width: 15 },
      { header: "Funktion", key: "Funktion", width: 15 },
      { header: "Ort", key: "Ort", width: 15 },
      { header: "BMK", key: "BMK", width: 15 },
      { header: "Hersteller", key: "Hersteller", width: 20 },
      { header: "Bestell_Nr_", key: "Bestell_Nr_", width: 20 },
      { header: "Teilemenge", key: "Teilemenge", width: 15 },
    ]

    invalidRows.forEach((row) => {
      invalidSheet.addRow({
        rowNumber: row.rowNumber,
        missingFields: row.missingFields,
        Anlage: row.Anlage,
        Funktion: row.Funktion,
        Ort: row.Ort,
        BMK: row.BMK,
        Hersteller: row.Hersteller,
        Bestell_Nr_: row.Bestell_Nr_,
        Teilemenge: row.Teilemenge,
      })
    })
  }

    // Kod durumları sayfası (Google Sheets kontrolü yapıldıysa)
    if ((codeCheckResult.missingCodes?.length || 0) > 0 || (codeCheckResult.unapprovedCodes?.length || 0) > 0) {
      const codeStatusSheet = outputWorkbook.addWorksheet("Kod Durumları")
      codeStatusSheet.columns = [
        { header: "Kod", key: "Kod", width: 30 },
        { header: "Durum", key: "Durum", width: 25 },
        { header: "Toplam Adet", key: "Count", width: 15 },
        { header: "Açıklama", key: "Description", width: 40 },
      ]
  
      // Eksik kodları ekle (tekilleştirilmiş)
      codeCheckResult.missingCodes?.forEach((code) => {
        // Bu kodun toplam kaç kez geçtiğini say
        const count = getAllCodesCount(ortGroups, code)
        codeStatusSheet.addRow({
          Kod: code,
          Durum: "Eksik",
          Count: count,
          Description: "Referans listede bulunamadı",
        })
      })
  
      // Onaysız kodları ekle (tekilleştirilmiş)
      codeCheckResult.unapprovedCodes?.forEach((code) => {
        // Bu kodun toplam kaç kez geçtiğini say
        const count = getAllCodesCount(ortGroups, code)
        codeStatusSheet.addRow({
          Kod: code,
          Durum: "Onaysız",
          Count: count,
          Description: "Referansta mevcut ancak onaylanmamış",
        })
      })
  
      // Özet bilgi
      codeStatusSheet.addRow([])
      codeStatusSheet.addRow({
        Kod: "ÖZET",
        Durum: `Eksik: ${codeCheckResult.missingCount || 0} (${codeCheckResult.missingCodes?.length || 0} farklı kod)`,
        Description: `Onaysız: ${codeCheckResult.unapprovedCount || 0} (${codeCheckResult.unapprovedCodes?.length || 0} farklı kod)`,
      })
    }

  // Save the workbook
  return outputWorkbook
}

// Bellek depolama alanını dışa aktar
export { memoryStorage }