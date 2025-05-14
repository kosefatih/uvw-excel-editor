import { google } from "googleapis"
import path from "path"
import fs from "fs"

// Google Sheets'ten veri okuma fonksiyonu
export async function readGoogleSheet(spreadsheetId, range) {
  try {
    const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64
    if (!base64Credentials) {
      throw new Error("GOOGLE_CREDENTIALS_BASE64 environment variable not set")
    }

    // Base64 string'i parse edilecek hale getir
    const credentials = JSON.parse(
      Buffer.from(base64Credentials, "base64").toString("utf-8")
    )

    const auth = new google.auth.GoogleAuth({
      credentials,
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


// Excel'den belirli sütunları okuyup Google Sheets formatına dönüştürme
export async function prepareDataForGoogleSheets(excelData) {
  return excelData.map((row) => {
    // Google Sheets'teki sütun sırasına göre düzenle:
    // G: Ürün Numarası (Excel'de B), H: Tip Numarası (D), I: Sipariş Numarası (E), J: Üretici (F), K: Üretici Adı (G)
    // Diğer sütunlar boş olacak (A-F arası)
    return [
      "", // A sütunu boş
      "", // B
      "", // C
      "", // D
      "", // E
      "", // F
      row["Ürün numarası"] || row["B"] || "", // G sütunu (Excel'den B)
      row["Tip numarası"] || row["D"] || "", // H sütunu (Excel'den D)
      row["Sipariş numarası"] || row["E"] || "", // I sütunu (Excel'den E)
      row["Üretici"] || row["F"] || "", // J sütunu (Excel'den F)
      row["Üretici adı"] || row["G"] || "", // K sütunu (Excel'den G)
    ];
  });
}

// Excel verisinden benzersiz ürünleri çıkarır (örneğin "ÜrünKodu" ile)
function filterUniqueByProductCode(data, productCodeKey = "ÜrünKodu") {
  const seen = new Set();
  return data.filter((item) => {
    const code = item[productCodeKey];
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

// Google Sheets verisinden sadece ürün kodlarını çeker
async function getExistingProductCodes(sheets, spreadsheetId, sheetName, column = "A") {
  const range = `${sheetName}!${column}2:${column}`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = result.data.values || [];
  return new Set(rows.map((row) => row[0]));
}

export async function transferProductDataFromExcelToGoogleSheet(
  excelFilePath,
  googleSpreadsheetId,
  googleSheetName = "Test"
) {
  try {
    // 1. Excel dosyasını oku
    const workbook = xlsx.readFile(excelFilePath);
    const firstSheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    if (!excelData || excelData.length === 0) {
      throw new Error("Excel dosyası boş veya okunamadı");
    }

    // 2. Aynı ürün koduna sahip Excel satırlarını eleyerek benzersiz hale getir
    const uniqueExcelData = filterUniqueByProductCode(excelData, "ÜrünKodu");

    // 3. Google kimlik doğrulaması
    const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!base64Credentials) {
      throw new Error("GOOGLE_CREDENTIALS_BASE64 environment variable not set");
    }

    const credentials = JSON.parse(
      Buffer.from(base64Credentials, "base64").toString("utf-8")
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    // 4. Mevcut ürün kodlarını Google Sheets'ten çek
    const existingProductCodes = await getExistingProductCodes(
      sheets,
      googleSpreadsheetId,
      googleSheetName,
      "G" // ÜrünKodu'nun G sütununda olduğunu varsayıyoruz
    );

    // 5. Excel verisinden sadece Google Sheet'te olmayanları al
    const newData = uniqueExcelData.filter(
      (item) => !existingProductCodes.has(item["ÜrünKodu"])
    );

    if (newData.length === 0) {
      return {
        success: true,
        message: "Aktarılacak yeni veri yok (tümü zaten mevcut).",
      };
    }

    // 6. Sheets'e uygun formata dönüştür
    const values = prepareDataForGoogleSheets(newData); // bu fonksiyon zaten sende var

    // 7. Verileri Google Sheet'e ekle
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: googleSpreadsheetId,
      range: `${googleSheetName}!A2:AD`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values,
      },
    });

    return {
      success: true,
      insertedRows: values.length,
      insertedProductCodes: newData.map((item) => item["ÜrünKodu"]),
      updatedRange: response.data.updates?.updatedRange,
    };
  } catch (error) {
    console.error("Veri aktarım hatası:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
