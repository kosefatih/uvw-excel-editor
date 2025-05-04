import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

// GET: Tüm exclusions verilerini getir
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("exclusions");

    const items = await collection.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Error fetching exclusions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// POST: Yeni bir exclusion ekle
export async function POST(request) {
  try {
    const data = await request.json();
    const { orderNumber } = data;

    if (!orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Order number is required",
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection("exclusions");

    const existing = await collection.findOne({ orderNumber });
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "This filter already exists",
      });
    }

    const result = await collection.insertOne({
      orderNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding exclusion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
