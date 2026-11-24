import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] || character);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessSlug = clean(body?.businessSlug, 120).toLowerCase();
    const senderName = clean(body?.senderName, 120);
    const senderEmail = clean(body?.senderEmail, 254).toLowerCase();
    const senderPhone = clean(body?.senderPhone, 40);
    const subject = clean(body?.subject, 160);
    const message = clean(body?.message, 5000);

    if (!businessSlug || senderName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail) ||
        subject.length < 2 || message.length < 10) {
      return NextResponse.json({ ok: false, error: "Please complete all required enquiry fields with valid details." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: enquiryId, error: submitError } = await admin.rpc("submit_business_enquiry", {
      p_business_slug: businessSlug,
      p_sender_name: senderName,
      p_sender_email: senderEmail,
      p_sender_phone: senderPhone || null,
      p_subject: subject,
      p_message: message
    });
    if (submitError || !enquiryId) {
      return NextResponse.json({ ok: false, error: submitError?.message || "Your enquiry could not be submitted." }, { status: 400 });
    }

    const { data: workspace, error: workspaceError } = await admin
      .from("business_workspaces")
      .select("id,owner_id,business_name,contact_email")
      .eq("business_slug", businessSlug)
      .eq("is_public", true)
      .eq("status", "active")
      .maybeSingle();

    if (workspaceError || !workspace) {
      await admin.from("business_enquiries").update({ email_notification_status: "failed" }).eq("id", enquiryId);
      return NextResponse.json({ ok: true, notificationSent: false });
    }

    let recipient = typeof workspace.contact_email === "string" ? workspace.contact_email.trim() : "";
    if (!recipient) {
      const { data: ownerResult } = await admin.auth.admin.getUserById(workspace.owner_id);
      recipient = ownerResult?.user?.email || "";
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from || !recipient) {
      await admin.from("business_enquiries").update({ email_notification_status: "skipped" }).eq("id", enquiryId);
      return NextResponse.json({ ok: true, notificationSent: false });
    }

    const safeBusiness = escapeHtml(workspace.business_name);
    const safeSender = escapeHtml(senderName);
    const safeEmail = escapeHtml(senderEmail);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);
    const safePhone = escapeHtml(senderPhone || "Not provided");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nbjcreative-hub.onrender.com";
    const inboxUrl = siteUrl.replace(/\/$/, "") + "/business/enquiries";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: "New business enquiry: " + subject,
        text: [
          "A new customer enquiry has arrived on NBJCreative Hub.",
          "Business: " + workspace.business_name,
          "From: " + senderName + " (" + senderEmail + ")",
          "Phone: " + (senderPhone || "Not provided"),
          "Subject: " + subject,
          "",
          message,
          "",
          "View your business enquiries: " + inboxUrl
        ].join("\n"),
        html: "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:640px;margin:auto\">" +
          "<h2>New business enquiry</h2><p>A customer has contacted <strong>" + safeBusiness + "</strong> through NBJCreative Hub.</p>" +
          "<p><strong>From:</strong> " + safeSender + "<br/><strong>Email:</strong> " + safeEmail +
          "<br/><strong>Phone:</strong> " + safePhone + "<br/><strong>Subject:</strong> " + safeSubject + "</p>" +
          "<div style=\"white-space:pre-wrap;background:#f4f7f8;padding:16px;border-radius:10px\">" + safeMessage + "</div>" +
          "<p><a href=\"" + escapeHtml(inboxUrl) + "\">Open your NBJ Business enquiry inbox</a></p></div>"
      })
    });

    if (!emailResponse.ok) {
      await admin.from("business_enquiries").update({ email_notification_status: "failed" }).eq("id", enquiryId);
      return NextResponse.json({ ok: true, notificationSent: false });
    }

    await admin.from("business_enquiries").update({
      email_notification_status: "sent",
      email_notification_sent_at: new Date().toISOString()
    }).eq("id", enquiryId);

    return NextResponse.json({ ok: true, notificationSent: true });
  } catch {
    return NextResponse.json({ ok: false, error: "We couldn't process your enquiry right now. Please try again." }, { status: 500 });
  }
}
