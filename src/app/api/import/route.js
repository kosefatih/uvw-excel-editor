// app/api/import/route.js
import { NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { google } from "googleapis";

export async function POST(request) {
  try {
    // 1. Form verilerini al
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type");

    if (!file || !type) {
      return NextResponse.json(
        { success: false, error: "Dosya ve tip bilgisi gereklidir" },
        { status: 400 }
      );
    }

    // 2. Excel dosyasını işle
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 3. Google Sheets kimlik doğrulama
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString()
      ),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

    // 4. Veriyi Google Sheets'e yaz
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: "1s8oYYkAtML4X4s4CoQu8jHrOajl2B842C9TTWuEVV7o",
      range: "Test!A2:AD2",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: prepareSheetData(data, type),
      },
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      updatedRange: response.data.updates?.updatedRange,
    });
  } catch (error) {
    console.error("İçe aktarım hatası:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Yardımcı fonksiyon: Excel verisini Google Sheets formatına dönüştürür
function prepareSheetData(data, type) {
  switch (type) {
    case "abbreviations":
      return data.map(row => [
        "", "", "", "", "", "",
        row["Ürün Numarası"] || "",
        row["Tip Numarası"] || "",
        row["Sipariş Numarası"] || "",
        row["Üretici"] || "",
        row["Üretici Adı"] || ""
      ]);
    case "replacements":
      return data.map(row => [
        "", "", "", "", "", "",
        row["Orijinal"] || "",
        row["Yeni"] || "",
        "", "", ""
      ]);
    case "exclusions":
      return data.map(row => [
        "", "", "", "", "", "",
        row["Sipariş Numarası"] || "",
        "", "", "", ""
      ]);
    default:
      return [];
  }
}