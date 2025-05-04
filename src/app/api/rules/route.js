import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  let client
  try {
    client = await connectToDatabase()
    const db = client.db()
    const collection = db.collection("rules")

    const items = await collection.find({ isActive: true }).sort({ priority: 1 }).toArray()

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("Error fetching rules:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  } finally {
    if (client) await client.close()
  }
}

export async function POST(request) {
  let client
  try {
    const rule = await request.json()

    if (!rule.regexPattern || !rule.outputFormat) {
      return NextResponse.json(
        {
          success: false,
          error: "Regex pattern and output format are required",
        },
        { status: 400 },
      )
    }

    client = await connectToDatabase()
    const db = client.db()
    const collection = db.collection("rules")

    const newRule = {
      ...rule,
      isActive: true,
      priority: rule.priority || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(newRule)

    return NextResponse.json({
      success: true,
      insertedId: result.insertedId,
      rule: { ...newRule, _id: result.insertedId },
    })
  } catch (error) {
    console.error("Error adding rule:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  } finally {
    if (client) await client.close()
  }
}
