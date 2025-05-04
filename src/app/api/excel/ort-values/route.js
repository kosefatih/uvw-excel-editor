import { NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import { join } from "path"
import * as ExcelJS from "exceljs"
import { v4 as uuidv4 } from "uuid"

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    // Dosyayı belleğe yükle
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Excel dosyasını bellek içinde işle
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]

    const headerRow = worksheet.getRow(1)
    const columnMap = {}

    headerRow.eachCell((cell, colNumber) => {
      const columnName = cell.value?.toString().trim()
      if (columnName) columnMap[columnName] = colNumber
    })

    if (!columnMap["Ort"]) {
      throw new Error("Ort sütunu bulunamadı")
    }

    const ortValues = new Set()
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const ortValue = row.getCell(columnMap["Ort"]).value?.toString().trim()
      if (ortValue) ortValues.add(ortValue)
    })

    return NextResponse.json({ success: true, ortValues: Array.from(ortValues).sort() })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
