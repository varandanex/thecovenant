import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const EXPORT_FILENAME = "thecovenant-export-formatted.json";
const DEFAULT_PATH = path.join(process.cwd(), "data", EXPORT_FILENAME);

let cachedPayload: any | null = null;

async function readExportFile(): Promise<any | null> {
  const configuredPath = process.env.CONTENT_EXPORT_PATH ?? DEFAULT_PATH;

  try {
    const raw = await fs.readFile(configuredPath, "utf-8");
    return JSON.parse(raw);
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.warn("No se pudo leer el export en la API:", error);
    }
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("refresh")) {
    cachedPayload = null;
  }

  if (!cachedPayload) {
    cachedPayload = await readExportFile();
  }

  if (!cachedPayload) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  return NextResponse.json(cachedPayload, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
}
