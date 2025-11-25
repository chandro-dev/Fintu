import { NextRequest, NextResponse } from "next/server";
import { items } from "../store";

const findIndex = (id: string) => items.findIndex((item) => item.id === id);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const index = findIndex(id);

  if (index === -1) {
    return NextResponse.json(
      { error: "Elemento no encontrado." },
      { status: 404 },
    );
  }

  const body = await request.json();
  const title = (body?.title ?? "").trim();
  const note = (body?.note ?? "").trim();

  if (!title) {
    return NextResponse.json(
      { error: "El titulo es obligatorio." },
      { status: 400 },
    );
  }

  items[index] = { ...items[index], title, note: note || undefined };

  return NextResponse.json(items[index]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const index = findIndex(id);

  if (index === -1) {
    return NextResponse.json(
      { error: "Elemento no encontrado." },
      { status: 404 },
    );
  }

  const [removed] = items.splice(index, 1);
  return NextResponse.json(removed);
}
