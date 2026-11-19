import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request) {
  try {
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ok:false,error:"Please sign in as an administrator."},{status:401});
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id",auth.user.id).maybeSingle();
    if (profileError) return NextResponse.json({ok:false,error:"Could not verify administrator access."},{status:500});
    if (profile?.role !== "admin") return NextResponse.json({ok:false,error:"Administrator permission is required."},{status:403});
    const body = await request.json();
    const reviewId = typeof body?.reviewId === "string" ? body.reviewId.trim() : "";
    const status = body?.status;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewId)) return NextResponse.json({ok:false,error:"Invalid review ID."},{status:400});
    if (!["published","rejected"].includes(status)) return NextResponse.json({ok:false,error:"Choose publish or reject."},{status:400});
    const {data:saved,error} = await admin.from("product_reviews").update({status}).eq("id",reviewId).select("id,status").maybeSingle();
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
    if(!saved)return NextResponse.json({ok:false,error:"Review not found."},{status:404});
    return NextResponse.json({ok:true,review:saved});
  } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unexpected review moderation error."},{status:500}); }
}