import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Please sign in before continuing." }, { status: 401 });
    }

    const body = await request.json();
    if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 20) {
      return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
    }

    const items = body.items.map((item: { productId?: unknown; quantity?: unknown }) => ({
      productId: typeof item?.productId === "string" ? item.productId : "",
      quantity: Number(item?.quantity)
    }));

    if (items.some((item: {productId:string;quantity:number}) =>
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productId) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10
    )) {
      return NextResponse.json({ error: "One or more cart items are invalid." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_pending_order", { p_items: items });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) {
      return NextResponse.json({ error: "We couldn't create your order. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "We couldn't process your order request. Please try again." }, { status: 400 });
  }
}
