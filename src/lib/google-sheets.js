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