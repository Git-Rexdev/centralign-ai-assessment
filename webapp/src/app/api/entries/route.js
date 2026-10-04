import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "..", "data", "entries.json");
    if (!existsSync(filePath)) {
      return NextResponse.json({ entries: [], count: 0 });
    }
    const raw = readFileSync(filePath, "utf-8");
    const entries = JSON.parse(raw);
    return NextResponse.json({ entries, count: entries.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
