import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const allUsers = await db.select().from(usersTable);
    return NextResponse.json(allUsers);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error fetching users", details: error.message },
      { status: 500 }
    );
  }
}

// POST new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.age || !body.email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await db
      .insert(usersTable)
      .values({
        name: body.name,
        age: body.age,
        email: body.email,
        pseudo: body.email,
      })
      .returning();

    const allUsers = await db.select().from(usersTable);

    return NextResponse.json(allUsers, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Error creating user" }, { status: 500 });
  }
}
