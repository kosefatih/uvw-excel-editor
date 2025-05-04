import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  try {

    const { db } = await connectToDatabase();
    const collection = db.collection("manual_abbreviations")

    const items = await collection.find({}).sort({ createdAt: -1 }).toArray()

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("Error fetching abbreviations:", error)
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
    const { orderNumber, abbreviation } = data

    if (!orderNumber || !abbreviation) {
      return NextResponse.json(
        {
          success: false,
          error: "Order number and abbreviation are required",
        },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()
    const collection = db.collection("manual_abbreviations")

    const existing = await collection.findOne({ orderNumber })

    await collection.updateOne(
      { orderNumber },
      {
        $set: {
          abbreviation,
          updatedAt: new Date(),
          ...(existing ? {} : { createdAt: new Date() }),
        },
      },
      { upsert: true },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding abbreviation:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
