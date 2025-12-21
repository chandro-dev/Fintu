import { NextResponse } from "next/server";

// Intenta obtener la tasa de intervención del Banco de la República (Colombia) desde su página pública.
// Nota: esta extracción es "best effort" y puede fallar si cambia el HTML.
export async function GET() {
  try {
    const res = await fetch("https://www.banrep.gov.co/es/estadisticas/tasa-intervencion", {
      // Evitar caches agresivos en serverless/dev.
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar BanRep", status: res.status },
        { status: 502 },
      );
    }

    const html = await res.text();
    const idx = html.toLowerCase().indexOf("tasa de intervención");
    const windowText = idx >= 0 ? html.slice(Math.max(0, idx - 2000), idx + 2000) : html;

    // Buscar un porcentaje cercano: 10,75 o 10.75
    const match = windowText.match(/(\d{1,2}[.,]\d{1,2})\s*%/);
    if (!match) {
      return NextResponse.json(
        { error: "No se pudo extraer la tasa desde BanRep" },
        { status: 502 },
      );
    }

    const value = Number(match[1].replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { error: "Tasa inválida obtenida desde BanRep" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      tasaIntervencionPct: value,
      fuente: "Banco de la República (tasa de intervención)",
      nota: "Es una referencia. La TEA de tu tarjeta puede diferir según el banco.",
    });
  } catch (e) {
    return NextResponse.json({ error: "Error consultando BanRep" }, { status: 502 });
  }
}

