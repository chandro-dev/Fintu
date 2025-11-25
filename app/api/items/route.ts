import { NextResponse } from "next/server";
import { items, type Item } from "./store";

export async function GET() {
  // Return sorted by newest first for a nicer UX.
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = (body?.title ?? "").trim();
  const note = (body?.note ?? "").trim();

  if (!title) {
    return NextResponse.json(
      { error: "El titulo es obligatorio." },
      { status: 400 },
    );
  }

  const newItem: Item = {
    id: crypto.randomUUID(),
    title,
    note: note || undefined,
    createdAt: Date.now(),
  };

  items.unshift(newItem);

  return NextResponse.json(newItem, { status: 201 });
}
