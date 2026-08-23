import { NextResponse } from "next/server";
import { discoverM1Feeds } from "@/server/discovery/feeds";

export async function GET() {
  try { return NextResponse.json({ items: await discoverM1Feeds() }); }
  catch { return NextResponse.json({ items: [], error: "Discovery is temporarily unavailable. Try again shortly." }, { status: 502 }); }
}
