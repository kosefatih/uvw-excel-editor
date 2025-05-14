import { NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { google } from "googleapis";

export async function POST(request) {
  try {
    // 1. Form verilerini al
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Dosya yüklenmedi." },
        { status: 400 }
      );
    }

    // 2. Excel dosyasını oku
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 3. Excel'den ürün numaralarını al
    const excelProductNumbers = data
      .map(row => row["Ürün numarası"]?.toString().trim())
      .filter(Boolean);

    // 4. Google Sheets'e bağlan
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString()
      ),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

    // 5. Google Sheet'teki mevcut ürün numaralarını al (G sütunu)
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: "1s8oYYkAtML4X4s4CoQu8jHrOajl2B842C9TTWuEVV7o",
      range: "Sayfa1!G2:G",
    });

    const existingProductNumbers = (existing.data.values || []).map(
      row => row[0]?.toString().trim()
    );

    // 6. Yeni ürünleri filtrele
    const newProductNumbers = excelProductNumbers.filter(
      num => !existingProductNumbers.includes(num)
    );

    const newRows = data.filter(row =>
      newProductNumbers.includes(row["Ürün numarası"]?.toString().trim())
    );

    if (newRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Yeni ürün yok. Hiçbir satır eklenmedi.",
        addedCount: 0,
      });
    }

    // 7. Yeni satırları formatla
    const formattedRows = newRows.map(row => [
      "", "", "", "", "", "",
      row["Ürün numarası"] || "",
      row["Tip numarası"] || "",
      row["Sipariş numarası"] || "",
      row["Üretici"] || "",
      row["Üretici adı"] || ""
    ]);

    // 8. Google Sheet'e ekle
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: "1s8oYYkAtML4X4s4CoQu8jHrOajl2B842C9TTWuEVV7o",
      range: "Sayfa1!A2:AD2",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: formattedRows,
      },
    });

    return NextResponse.json({
      success: true,
      addedCount: newRows.length,
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
