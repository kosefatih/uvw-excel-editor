import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function DELETE(request, { params }) {
  try {
    const { orderNumber } = params;

    if (!orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Order number is required",
        },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()
    const collection = db.collection("manual_abbreviations")

    const result = await collection.deleteOne({ orderNumber })

    return NextResponse.json({
      success: result.deletedCount > 0,
    })
  } catch (error) {
    console.error("Error deleting abbreviation:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
