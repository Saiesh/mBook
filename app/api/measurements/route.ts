import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Fetch measurements from database
  return NextResponse.json([]);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // TODO: Save to database
    // For now, just return the data
    
    return NextResponse.json({
      success: true,
      data: {
        id: Date.now().toString(),
        ...body,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create measurement" },
      { status: 500 }
    );
  }
}
