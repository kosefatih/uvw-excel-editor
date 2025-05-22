import { NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { google } from 'googleapis';

// Google Sheets API ayarları
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Makro Kontrol';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Google Auth için service account
let credentials;
try {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString();
  credentials = JSON.parse(credentialsJson);
} catch (error) {
  console.error('Error parsing credentials:', error);
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES,
});

export async function POST(request) {
  try {
    // Environment variables kontrolü
    if (!SPREADSHEET_ID || !process.env.GOOGLE_CREDENTIALS_BASE64) {
      console.error('Missing environment variables:', {
        hasSpreadsheetId: !!SPREADSHEET_ID,
        hasCredentials: !!process.env.GOOGLE_CREDENTIALS_BASE64
      });
      return NextResponse.json(
        { success: false, error: 'Google Sheets API yapılandırması eksik' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Dosya yüklenmedi' },
        { status: 400 }
      );
    }

    // Dosya tipini kontrol et
    if (!file.type.includes('spreadsheet') && !file.type.includes('excel')) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz dosya formatı. Lütfen Excel dosyası yükleyin.' },
        { status: 400 }
      );
    }

    // Dosyayı belleğe yükle
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Excel dosyasını bellek içinde işle
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json(
        { success: false, error: 'Excel dosyasında sayfa bulunamadı' },
        { status: 400 }
      );
    }

    // Sütun haritasını oluştur (2. satırdan)
    const headerRow = worksheet.getRow(2);
    const columnMap = {};
    headerRow.eachCell((cell, colNumber) => {
      const columnName = cell.value?.toString().trim();
      if (columnName) columnMap[columnName] = colNumber;
    });

    // Gerekli sütunları kontrol et
    const requiredColumns = ['Ürün numarası', 'Tip numarası', 'Sipariş numarası', 'Üretici', 'Üretici adı'];
    const missingColumns = requiredColumns.filter(col => !columnMap[col]);
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { success: false, error: `Eksik sütunlar: ${missingColumns.join(', ')}` },
        { status: 400 }
      );
    }

   
    const newRows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // İlk iki satırı atla (başlık ve sütun isimleri)

     
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const columnName = worksheet.getRow(2).getCell(colNumber).value?.toString().trim();
        if (columnName) {
          rowData[columnName] = cell.value?.toString().trim();
        }
      });

      // Ana verilerimizi al
      const mainData = {
        productNumber: rowData['Ürün numarası'],
        typeNumber: rowData['Tip numarası'],
        orderNumber: rowData['Sipariş numarası'],
        manufacturer: rowData['Üretici'],
        manufacturerName: rowData['Üretici adı'],
      };

      if (mainData.productNumber) {
        newRows.push({ ...rowData, ...mainData });
      }
    });

    if (newRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Excel dosyasında işlenecek veri bulunamadı' },
        { status: 400 }
      );
    }

    try {
      // Google Sheets API client
      const sheets = google.sheets({ version: 'v4', auth });

      // Mevcut verileri al
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!G2:G`,
      });

      const existingProductNumbers = response.data.values?.flat() || [];

     
      const filteredRows = newRows.filter(
        (row) => !existingProductNumbers.includes(row.productNumber)
      );

      if (filteredRows.length === 0) {
        return NextResponse.json(
          { success: true, message: 'Tüm ürünler zaten mevcut, yeni kayıt eklenmedi.' },
          { status: 200 }
        );
      }

      // Google Sheets'e eklenecek veriyi hazırla
      const values = filteredRows.map((row) => {
        // A'dan AD'ye kadar olan tüm sütunları hazırla
        const allColumns = Array(30).fill(''); 

        
        allColumns[0] = "False";  // A sütunu (checkbox)
        allColumns[3] = "False";  // D sütunu (checkbox)
        allColumns[1] = '';  
        allColumns[11] = ''; 
        allColumns[12] = ''; 
        allColumns[13] = ''; 
        allColumns[14] = ''; 
        allColumns[15] = ''; 
        allColumns[16] = ''; 
        allColumns[17] = ''; 
        allColumns[18] = ''; 
        allColumns[19] = ''; 
        allColumns[20] = ''; 
        allColumns[21] = ''; 
        allColumns[22] = '';
        allColumns[23] = '';
        allColumns[24] = ''; 
        allColumns[25] = ''; 
        allColumns[26] = '';
        allColumns[27] = ''; 
        allColumns[28] = '';
        allColumns[29] = '';
        // C sütunu boş
        allColumns[2] = '';
        // F sütunu boş
        allColumns[5] = '';
        allColumns[6] = row.productNumber;        // G sütunu
        allColumns[7] = row.typeNumber;           // H sütunu
        allColumns[8] = row.orderNumber;          // I sütunu
        allColumns[9] = row.manufacturer;         // J sütunu
        allColumns[10] = row.manufacturerName;    // K sütunu

        return allColumns;
      });

      // Google Sheets'e veriyi ekle
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      return NextResponse.json(
        { 
          success: true,
          message: `${filteredRows.length} yeni kayıt başarıyla eklendi.`,
          added: filteredRows.length
        },
        { status: 200 }
      );
    } catch (googleError) {
      console.error('Google Sheets API Error:', googleError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Sheets ile iletişim kurulurken hata oluştu: ' + googleError.message 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('General Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'İşlem sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Kullanım örneği
// .env dosyanızda GOOGLE_SHEET_ID, GOOGLE_CREDENTIALS_BASE64 tanımlı olmalı
// uploadExcelToGoogleSheets('path/to/your/excel/file.xlsx');