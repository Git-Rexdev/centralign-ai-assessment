import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const filePath = path.join(process.cwd(), "..", "data", "invoices.json");
    const raw = readFileSync(filePath, "utf-8");
    const invoices = JSON.parse(raw);
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company") || "";
    const filtered = company
      ? invoices.filter((inv) => inv.company.toLowerCase().includes(company.toLowerCase()))
      : invoices;
    return NextResponse.json({ invoices: filtered, count: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
