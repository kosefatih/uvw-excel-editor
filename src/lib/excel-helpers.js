import { read, utils } from "xlsx"

// Excel dosyasını oku ve içeriğini JSON olarak döndür
export async function readExcelFile(file) {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Başlık satırını kontrol et
    const range = utils.decode_range(worksheet["!ref"])
    const headers = []

    // İlk satırı başlık olarak oku
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[utils.encode_cell({ r: 0, c: C })]
      headers[C] = cell ? cell.v : undefined
    }

    console.log("Excel başlıkları:", headers)

    // Veriyi oku - hem başlık adlarıyla hem de sütun harfleriyle
    const data = utils.sheet_to_json(worksheet, {
      defval: "",
      range: 1, // İlk satırı başlık olarak atla
    })

    // Sütun harfleriyle de erişilebilir veri oluştur
    const dataWithColumnLetters = utils.sheet_to_json(worksheet, {
      header: "A",
      range: 1,
      defval: "",
    })

    // İki veri setini birleştir
    const mergedData = data.map((row, index) => {
      return { ...row, ...dataWithColumnLetters[index] }
    })

    return {
      success: true,
      data: mergedData,
      headers,
    }
  } catch (error) {
    console.error("Excel okuma hatası:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Ürün numaralarını çıkar
export function extractProductNumbers(data) {
  return data
    .map((row) => {
      // Hem sütun adı hem de harf notasyonuyla dene
      const productNumber = row["Ürün numarası"] || row["B"] || ""
      return productNumber.toString().trim()
    })
    .filter(Boolean)
}

// Google Sheets için satırları formatla
export function formatRowsForGoogleSheets(rows) {
  return rows.map((row) => [
    "",
    "",
    "",
    "",
    "",
    "",
    row["Ürün numarası"] || row["B"] || "",
    row["Tip numarası"] || row["D"] || "",
    row["Sipariş numarası"] || row["E"] || "",
    row["Üretici"] || row["F"] || "",
    row["Üretici adı"] || row["G"] || "",
  ])
}
