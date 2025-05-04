import { NextResponse } from "next/server"
import { checkCodesAgainstGoogleSheet } from "@/lib/google-sheets"

export async function POST(request) {
  try {
    const { codes } = await request.json()

    if (!Array.isArray(codes)) {
      return NextResponse.json(
        {
          success: false,
          error: "Kodlar bir dizi olarak gönderilmelidir",
        },
        { status: 400 },
      )
    }

    const result = await checkCodesAgainstGoogleSheet(codes)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Kod kontrol hatası:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Kodlar kontrol edilirken bir hata oluştu",
      },
      { status: 500 },
    )
  }
}
