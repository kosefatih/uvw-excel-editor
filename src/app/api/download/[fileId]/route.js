import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { memoryStorage } from "@/app/api/excel/process/route"


export async function GET(request, { params }) {
  try {
    const { fileId } = await params
    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 })
    }

    // Bellek depolama alanından dosyayı al
    const fileData = memoryStorage.get(fileId)

    if (!fileData) {
      return NextResponse.json({ error: "File not found or expired" }, { status: 404 })
    }

    // Dosyayı indir
    return new NextResponse(fileData.buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="processed_output.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    })
  } catch (error) {
    console.error("Error downloading file:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to download file",
      },
      { status: 500 },
    )
  }
}
