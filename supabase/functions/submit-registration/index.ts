// supabase/functions/submit-registration/index.ts
//
// Deploy with: supabase functions deploy submit-registration
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   TURNSTILE_SECRET_KEY        - from your Cloudflare Turnstile dashboard
//   SUPABASE_URL                - auto-available in Edge Functions, no need to set
//   SUPABASE_SERVICE_ROLE_KEY   - Project Settings > API > service_role key
//
// The React app calls THIS function (not supabase.rpc directly) and sends
// both the form data and the Turnstile token it got from the widget.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  // Tighten this to your actual frontend domain before going to production.
  "Access-Control-Allow-Origin": "https://guardian-connect-beryl.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REQUIRED_FIELDS = [
  "guardianFirstName",
  "guardianLastName",
  "guardianIdentityDocumentNum",
  "firstName",
  "lastName",
  "identityDocumentNum",
  "birthdate",
  "phoneNumber",
  "residenceZone",
  "weight",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { captchaToken, formData } = body ?? {};

  if (!captchaToken || typeof captchaToken !== "string") {
    return jsonResponse({ error: "Missing captcha token" }, 400);
  }
  if (!formData || typeof formData !== "object") {
    return jsonResponse({ error: "Missing form data" }, 400);
  }

  // Real client IP - Supabase Edge Functions run behind a proxy that sets this.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // ---- 1. Verify CAPTCHA server-side (never trust a client-only check) ----
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!turnstileSecret) {
    console.error("TURNSTILE_SECRET_KEY is not set");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: captchaToken,
        ...(clientIp ? { remoteip: clientIp } : {}),
      }),
    }
  );

  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return jsonResponse({ error: "Captcha verification failed" }, 403);
  }

  // ---- 2. Minimal server-side presence validation ----
  // (Detailed format checks - phone regex, id length, etc. - are enforced
  // by the DB constraints; this is just a fast-fail for obviously missing data.)
  for (const field of REQUIRED_FIELDS) {
    if (!formData[field]) {
      return jsonResponse({ error: `Missing field: ${field}` }, 400);
    }
  }

  // ---- 3. Call the RPC using the service role key ----
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.rpc("submit_registration", {
    g_first_name: formData.guardianFirstName,
    g_last_name: formData.guardianLastName,
    g_identity_doc: formData.guardianIdentityDocumentNum,
    c_first_name: formData.firstName,
    c_last_name: formData.lastName,
    c_identity_doc: formData.identityDocumentNum,
    c_birthdate: formData.birthdate,
    c_phone: formData.phoneNumber,
    c_zone: formData.residenceZone,
    m_condition: formData.condition ?? null,
    m_medications: formData.medications ?? [],
    c_weight: formData.weight ?? null,
    c_dietary_constraints: formData.dietaryConstraints ?? [],
    p_client_ip: clientIp,
  });

  if (error) {
    const isRateLimit = error.message?.toLowerCase().includes("rate limit");
    const isConstraintViolation = error.code === "23514" || error.code === "23505";
    if (isRateLimit) {
      return jsonResponse({ error: "Too many submissions. Please try again later." }, 429);
    }
    if (isConstraintViolation) {
      return jsonResponse({ error: "Invalid field format." }, 400);
    }
    console.error("submit_registration error:", error);
    return jsonResponse({ error: "Submission failed." }, 500);
  }

  return jsonResponse({ success: true, childId: data }, 200);
});
