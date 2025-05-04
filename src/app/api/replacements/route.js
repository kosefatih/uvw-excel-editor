import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  try {

    const { db } = await connectToDatabase()
    const collection = db.collection("order_replacements")

    const items = await collection.find({}).sort({ createdAt: -1 }).toArray()

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("Error fetching replacements:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    const { originalOrderNumber, replacementOrderNumber } = data

    if (!originalOrderNumber || !replacementOrderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Original and replacement order numbers are required",
        },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()
    const collection = db.collection("order_replacements")

    const existing = await collection.findOne({ originalOrderNumber })

    await collection.updateOne(
      { originalOrderNumber },
      {
        $set: {
          replacementOrderNumber,
          updatedAt: new Date(),
          ...(existing ? {} : { createdAt: new Date() }),
        },
      },
      { upsert: true },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding replacement:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
