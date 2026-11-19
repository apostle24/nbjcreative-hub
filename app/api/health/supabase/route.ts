import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("categories")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, service: "supabase", message: "Database query failed." },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, service: "supabase", database: "connected" });
  } catch {
    return NextResponse.json(
      { ok: false, service: "supabase", message: "Supabase environment is not configured." },
      { status: 503 }
    );
  }
}
