import { google } from "googleapis";
import * as xlsx from "xlsx"; // Eksikti, eklendi

// Google Sheets'ten veri okuma fonksiyonu
export async function readGoogleSheet(spreadsheetId, range) {
  try {
    const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!base64Credentials) {
      throw new Error("GOOGLE_CREDENTIALS_BASE64 environment variable not set");
    }

    const credentials = JSON.parse(
      Buffer.from(base64Credentials, "base64").toString("utf-8")
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return res.data.values ?? [];
  } catch (error) {
    console.error("Google Sheets okuma hatası:", error);
    throw error;
  }
}

// Kodları Google Sheets ile kontrol etme fonksiyonu
export async function checkCodesAgainstGoogleSheet(codes) {
  try {
    const SPREADSHEET_ID = "1DrI9mqm9MaV_NtX7OAGbxbL1XdM1X5OTeDbg1XDLgUY";
    const RANGE = "Makro Kontrol!A:G";

    const sheetData = await readGoogleSheet(SPREADSHEET_ID, RANGE);

    if (!sheetData || sheetData.length === 0) {
      return {
        success: true,
        missingCodes: [],
        unapprovedCodes: [],
        totalChecked: codes.length,
        existingCount: codes.length,
      };
    }

    const approvedCodes = new Set();
    const allCodesInSheet = new Set();

    sheetData.forEach((row) => {
      const isApprovedGeneral = row[0]?.toString().toLowerCase() === "true";
      const isApprovedSpecific = row[3]?.toString().toLowerCase() === "true";
      const code = row[6]?.toString().trim().toUpperCase();

      if (code) {
        allCodesInSheet.add(code);
        if (isApprovedGeneral && isApprovedSpecific) {
          approvedCodes.add(code);
        }
      }
    });

    const missingCodes = [];
    const unapprovedCodes = [];

    codes.forEach((code) => {
      const normalizedCode = code?.toString().trim().toUpperCase();
      if (!normalizedCode) return;

      if (!allCodesInSheet.has(normalizedCode)) {
        missingCodes.push(code);
      } else if (!approvedCodes.has(normalizedCode)) {
        unapprovedCodes.push(code);
      }
    });

    return {
      success: true,
      missingCodes: [...new Set(missingCodes)],
      unapprovedCodes: [...new Set(unapprovedCodes)],
      totalChecked: codes.length,
      existingCount: codes.length - missingCodes.length - unapprovedCodes.length,
      missingCount: [...new Set(missingCodes)].length,
      unapprovedCount: [...new Set(unapprovedCodes)].length,
    };
  } catch (error) {
    console.error("Google Sheet kontrol hatası:", error);
    return {
      success: false,
      error: error.message,
      missingCodes: [],
      unapprovedCodes: [],
      totalChecked: codes.length,
      existingCount: codes.length,
    };
  }
}

// Belirli kodun tüm verilerde kaç kez geçtiğini bul
export function getAllCodesCount(ortGroups, targetCode) {
  let count = 0;
  const normalizedTarget = targetCode?.toString().trim().toUpperCase();

  if (!normalizedTarget) return 0;

  Object.values(ortGroups).forEach((group) => {
    group.forEach((item) => {
      const normalizedItemCode = item.Kod?.toString().trim().toUpperCase();
      if (normalizedItemCode === normalizedTarget) {
        count += item.Adet || 1;
      }
    });
  });

  return count;
}

// Excel'den gelen verileri Google Sheets'e uygun hale getir
export async function prepareDataForGoogleSheets(excelData) {
  return excelData.map((row) => {
    return [
      "", // A
      "", // B
      "", // C
      "", // D
      "", // E
      "", // F
      row["Ürün numarası"] || row["B"] || "", // G
      row["Tip numarası"] || row["D"] || "", // H
      row["Sipariş numarası"] || row["E"] || "", // I
      row["Üretici"] || row["F"] || "", // J
      row["Üretici adı"] || row["G"] || "", // K
    ];
  });
}

// Google Sheets'teki mevcut ürün kodlarını alır
async function getExistingProductCodes(sheets, spreadsheetId, sheetName, column = "G") {
  const range = `${sheetName}!${column}2:${column}`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = result.data.values || [];
  return new Set(rows.map((row) => row[0]?.toString().trim()).filter(Boolean));
}

// Excel'den Google Sheet'e veri aktarımı
export async function transferProductDataFromExcelToGoogleSheet(
  excelFilePath,
  googleSpreadsheetId,
  googleSheetName = "Sayfa1"
) {
  try {
    const workbook = xlsx.readFile(excelFilePath);
    const firstSheetName = workbook.SheetNames[0];
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      range: 1, // 0-index: 1 demek 2. satırdan başla (başlık olarak kabul et)
      defval: "", // boş hücreler için "" ata
});
    console.log("Excel'den okunan veri:", excelData); // <== EKLEDİK


    if (!excelData || excelData.length === 0) {
      throw new Error("Excel dosyası boş veya okunamadı");
    }

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

    const existingProductCodes = await getExistingProductCodes(
      sheets,
      googleSpreadsheetId,
      googleSheetName,
      "G"
    );

    const newData = excelData.filter((row) => {
      const productNo = row["Ürün numarası"] || row["B"] || "";
      return productNo && !existingProductCodes.has(productNo);
    });

    if (newData.length === 0) {
      return {
        success: true,
        message: "Aktarılacak yeni veri yok (tümü zaten mevcut).",
      };
    }

    const values = await prepareDataForGoogleSheets(newData);

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
      insertedProductCodes: newData.map((row) => row["Ürün numarası"] || row["B"] || ""),
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
