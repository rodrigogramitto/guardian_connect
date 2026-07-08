import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { FormErrors, RegistrationFormData } from "../types";
import { hasFormErrors, validateRegistrationForm } from "../lib/validation";
import { submitRegistration } from "../lib/api";
import { TurnstileWidget } from "./TurnstileWidget";
import type { TurnstileWidgetHandle } from "./TurnstileWidget";
import { MedicationRows } from "./MedicationRows";
import { DietaryConstraintRows } from "./DietaryConstraintRows";

const EMPTY_FORM: RegistrationFormData = {
  guardianFirstName: "",
  guardianLastName: "",
  guardianIdentityDocumentNum: "",
  firstName: "",
  lastName: "",
  identityDocumentNum: "",
  birthdate: "",
  phoneNumber: "",
  residenceZone: "",
  condition: "",
  medications: [],
  dietaryConstraints: [],
  weight: 0
};

type SubmissionState = "idle" | "submitting" | "success";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

export function RegistrationForm() {
  const [form, setForm] = useState<RegistrationFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  function updateField<K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setSubmitError(null);
    setIsRateLimited(false);

    const validationErrors = validateRegistrationForm(form);
    setErrors(validationErrors);
    if (hasFormErrors(validationErrors)) return;

    if (!captchaToken) {
      setSubmitError("Complete la verificación de seguridad antes de enviar.");
      return;
    }

    setSubmissionState("submitting");
    const result = await submitRegistration(captchaToken, form);

    switch (result.status) {
      case "success":
        setSubmissionState("success");
        return;
      case "rate_limited":
        setIsRateLimited(true);
        setSubmitError("Se han recibido demasiadas solicitudes desde su conexión. Por favor espere unos minutos e intente nuevamente.");
        break;
      case "captcha_failed":
        setSubmitError("La verificación de seguridad falló, por favor inténtelo de nuevo.");
        break;
      case "error":
        setSubmitError(result.message);
        break;
    }

    setSubmissionState("idle");
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  if (submissionState === "success") {
    return (
      <div className="confirmation" role="status">
        <h1>Gracias</h1>
        <p>Su registro fue enviado.</p>
      </div>
    );
  }

  const isSubmitting = submissionState === "submitting";

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate>
      <h1>Registro de Niño, Niña o Adolescente</h1>

      <fieldset>
        <legend>Datos del representante</legend>

        <div className="field">
          <label htmlFor="guardianFirstName">Nombre (opcional)</label>
          <input
            id="guardianFirstName"
            type="text"
            value={form.guardianFirstName}
            onChange={(e) => updateField("guardianFirstName", e.target.value)}
          />
          {touched && errors.guardianFirstName && <span className="field-error">{errors.guardianFirstName}</span>}
        </div>

        <div className="field">
          <label htmlFor="guardianLastName">Apellido (opcional)</label>
          <input
            id="guardianLastName"
            type="text"
            value={form.guardianLastName}
            onChange={(e) => updateField("guardianLastName", e.target.value)}
          />
          {touched && errors.guardianLastName && <span className="field-error">{errors.guardianLastName}</span>}
        </div>

        <div className="field">
          <label htmlFor="guardianIdentityDocumentNum">Cédula de identidad (opcional)</label>
          <input
            id="guardianIdentityDocumentNum"
            type="text"
            value={form.guardianIdentityDocumentNum}
            onChange={(e) => updateField("guardianIdentityDocumentNum", e.target.value)}
          />
          {touched && errors.guardianIdentityDocumentNum && (
            <span className="field-error">{errors.guardianIdentityDocumentNum}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="phoneNumber">Número de teléfono (opcional)</label>
          <input
            id="phoneNumber"
            type="tel"
            placeholder="0412-1234567"
            value={form.phoneNumber}
            onChange={(e) => updateField("phoneNumber", e.target.value)}
          />
          {touched && errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
        </div>

        <div className="field">
          <label htmlFor="residenceZone">Zona de residencia (opcional)</label>
          <input
            id="residenceZone"
            type="text"
            value={form.residenceZone}
            onChange={(e) => updateField("residenceZone", e.target.value)}
          />
          {touched && errors.residenceZone && <span className="field-error">{errors.residenceZone}</span>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Datos del niño, niña o adolescente</legend>

        <div className="field">
          <label htmlFor="firstName">Nombre</label>
          <input
            id="firstName"
            type="text"
            value={form.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
          {touched && errors.firstName && <span className="field-error">{errors.firstName}</span>}
        </div>

        <div className="field">
          <label htmlFor="lastName">Apellido</label>
          <input
            id="lastName"
            type="text"
            value={form.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
          {touched && errors.lastName && <span className="field-error">{errors.lastName}</span>}
        </div>

        <div className="field">
          <label htmlFor="identityDocumentNum">Cédula de identidad (opcional)</label>
          <input
            id="identityDocumentNum"
            type="text"
            value={form.identityDocumentNum}
            onChange={(e) => updateField("identityDocumentNum", e.target.value)}
          />
          {touched && errors.identityDocumentNum && <span className="field-error">{errors.identityDocumentNum}</span>}
        </div>

        <div className="field">
          <label htmlFor="birthdate">Fecha de nacimiento (opcional)</label>
          <input
            id="birthdate"
            type="date"
            value={form.birthdate}
            onChange={(e) => updateField("birthdate", e.target.value)}
          />
          {touched && errors.birthdate && <span className="field-error">{errors.birthdate}</span>}
        </div>

        <div className="field">
          <label htmlFor="weight">Peso (kg) (opcional)</label>
          <input
            id="weight"
            type="number"
            min="0"
            step="0.1"
            value={form.weight || ""}
            onChange={(e) => updateField("weight", e.target.value === "" ? 0 : Number(e.target.value))}
          />
          {touched && errors.weight && <span className="field-error">{errors.weight}</span>}
        </div>

        <div className="field">
          <label htmlFor="condition">Condición (opcional)</label>
          <textarea
            id="condition"
            value={form.condition}
            onChange={(e) => updateField("condition", e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Medicamentos (opcional)</legend>
        <MedicationRows
          medications={form.medications}
          errors={touched ? errors.medications : undefined}
          onChange={(medications) => updateField("medications", medications)}
        />
      </fieldset>

      <fieldset>
        <legend>Restricciones alimenticias (opcional)</legend>
        <DietaryConstraintRows
          constraints={form.dietaryConstraints}
          errors={touched ? errors.dietaryConstraints : undefined}
          onChange={(dietaryConstraints) => updateField("dietaryConstraints", dietaryConstraints)}
        />
      </fieldset>

      <div className="captcha-container">
        <TurnstileWidget
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
        />
      </div>

      {submitError && (
        <p className={isRateLimited ? "form-message form-message-warning" : "form-message form-message-error"} role="alert">
          {submitError}
        </p>
      )}

      <button type="submit" className="button-primary" disabled={isSubmitting || !captchaToken}>
        {isSubmitting ? "Enviando..." : "Enviar registro"}
      </button>
    </form>
  );
}
