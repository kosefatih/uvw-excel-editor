import { NextResponse } from "next/server"

// Bu API rotası artık gerekli değil, ancak geriye dönük uyumluluk için tutuyoruz
export async function GET() {
  try {
    // Artık dosya sistemi kullanmadığımız için sadece başarılı yanıt dönüyoruz
    return NextResponse.json({ success: true, message: "In-memory storage is ready" })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
