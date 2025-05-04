import { google } from "googleapis"
import path from "path"
import fs from "fs"

// Google Sheets'ten veri okuma fonksiyonu
export async function readGoogleSheet(spreadsheetId, range) {
  try {
    // Kimlik bilgilerini yükle
    const credentialsPath = path.join(process.cwd(), "credentials.json")

    // Kimlik bilgileri dosyası yoksa hata fırlat
    if (!fs.existsSync(credentialsPath)) {
      console.error("credentials.json dosyası bulunamadı")
      throw new Error("Google Sheets kimlik bilgileri bulunamadı")
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })

    const client = await auth.getClient()
    const sheets = google.sheets({ version: "v4", auth: client })

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    return res.data.values || []
  } catch (error) {
    console.error("Google Sheets okuma hatası:", error)
    throw error
  }
}

// Kodları Google Sheets ile kontrol etme fonksiyonu
export async function checkCodesAgainstGoogleSheet(codes) {
  try {
    const SPREADSHEET_ID = "1DrI9mqm9MaV_NtX7OAGbxbL1XdM1X5OTeDbg1XDLgUY"
    // A sütunu: Onay durumu, D sütunu: Onay durumu, G sütunu: Kodlar
    const RANGE = "Makro Kontrol!A:G" // Tüm sütunları alıyoruz

    const sheetData = await readGoogleSheet(SPREADSHEET_ID, RANGE)

    if (!sheetData || sheetData.length === 0) {
      console.warn("Google Sheet verisi boş veya alınamadı")
      return {
        success: true,
        missingCodes: [],
        unapprovedCodes: [],
        totalChecked: codes.length,
        existingCount: codes.length,
      }
    }

    // Onaylı kodları depolamak için Set
    const approvedCodes = new Set()
    // Tüm kodları depolamak için (eksik kontrolü için)
    const allCodesInSheet = new Set()

    // Her satır için A (genel onay), D (onay) ve G (kod) sütunlarını kontrol et
    sheetData.forEach((row) => {
      const isApprovedGeneral = row[0]?.toString().toLowerCase() === "true" // A sütunu (0. indeks)
      const isApprovedSpecific = row[3]?.toString().toLowerCase() === "true" // D sütunu (3. indeks)
      const code = row[6]?.toString().trim().toUpperCase() // G sütunu (6. indeks)

      if (code) {
        allCodesInSheet.add(code)
        if (isApprovedGeneral && isApprovedSpecific) {
          approvedCodes.add(code)
        }
      }
    })

    // Eksik ve onaysız kodları bul
    const missingCodes = []
    const unapprovedCodes = []

    codes.forEach((code) => {
      const normalizedCode = code?.toString().trim().toUpperCase()
      if (!normalizedCode) return

      if (!allCodesInSheet.has(normalizedCode)) {
        // Kod listede yoksa
        missingCodes.push(code)
      } else if (!approvedCodes.has(normalizedCode)) {
        // Kod var ama onaylı değil
        unapprovedCodes.push(code)
      }
    })

    // Tekilleştirilmiş listeler oluştur
    const uniqueMissingCodes = [...new Set(missingCodes)]
    const uniqueUnapprovedCodes = [...new Set(unapprovedCodes)]

    return {
      success: true,
      missingCodes: uniqueMissingCodes,
      unapprovedCodes: uniqueUnapprovedCodes,
      totalChecked: codes.length,
      existingCount: codes.length - missingCodes.length - unapprovedCodes.length,
      missingCount: uniqueMissingCodes.length,
      unapprovedCount: uniqueUnapprovedCodes.length,
    }
  } catch (error) {
    console.error("Google Sheet kontrol hatası:", error)
    return {
      success: false,
      error: error.message,
      missingCodes: [],
      unapprovedCodes: [],
      totalChecked: codes.length,
      existingCount: codes.length,
    }
  }
}

// Tüm kodların toplam sayısını hesaplama yardımcı fonksiyonu
export function getAllCodesCount(ortGroups, targetCode) {
  let count = 0
  const normalizedTarget = targetCode?.toString().trim().toUpperCase()

  if (!normalizedTarget) return 0

  Object.values(ortGroups).forEach((group) => {
    group.forEach((item) => {
      const normalizedItemCode = item.Kod?.toString().trim().toUpperCase()
      if (normalizedItemCode === normalizedTarget) {
        count += item.Adet || 1
      }
    })
  })

  return count
}
