import type { RegistrationFormData } from "../types";

export type SubmitRegistrationResult =
  | { status: "success"; childId: string }
  | { status: "rate_limited" }
  | { status: "captcha_failed" }
  | { status: "error"; message: string };

export async function submitRegistration(
  captchaToken: string,
  formData: RegistrationFormData
): Promise<SubmitRegistrationResult> {
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-registration`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ captchaToken, formData }),
      }
    );
  } catch {
    return { status: "error", message: "No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo." };
  }

  let result: { childId?: string; error?: string } = {};
  try {
    result = await response.json();
  } catch {
    // fall through with an empty result; status code drives the branch below
  }

  if (response.ok) {
    return { status: "success", childId: result.childId ?? "" };
  }

  if (response.status === 429) {
    return { status: "rate_limited" };
  }

  if (response.status === 403) {
    return { status: "captcha_failed" };
  }

  return {
    status: "error",
    message: result.error ?? "Ocurrió un error al enviar el registro. Intente nuevamente.",
  };
}
