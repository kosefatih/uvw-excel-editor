import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function DELETE(request, { params }) {
  try {
    const { originalOrderNumber } = params;

    if (!originalOrderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Original order number is required",
        },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()
    const collection = db.collection("order_replacements")

    const result = await collection.deleteOne({ originalOrderNumber })

    return NextResponse.json({
      success: result.deletedCount > 0,
    })
  } catch (error) {
    console.error("Error deleting replacement:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
