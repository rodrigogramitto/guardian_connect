import type { FormErrors, RegistrationFormData } from "../types";

const IDENTITY_DOC_MIN = 5;
const IDENTITY_DOC_MAX = 20;

export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.replace(/[\s-()]/g, "");
  return cleaned.startsWith("+") ? `+${cleaned.slice(1).replace(/\D/g, "")}` : cleaned.replace(/\D/g, "");
}

export function isValidVenezuelanPhone(raw: string): boolean {
  const digits = normalizePhoneNumber(raw).replace(/^\+/, "");
  const local = digits.startsWith("58") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^4\d{9}$/.test(local);
}

function isValidIdentityDocument(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= IDENTITY_DOC_MIN && trimmed.length <= IDENTITY_DOC_MAX;
}

function isValidPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

export function validateRegistrationForm(form: RegistrationFormData): FormErrors {
  const errors: FormErrors = {};

  if (form.guardianIdentityDocumentNum.trim() && !isValidIdentityDocument(form.guardianIdentityDocumentNum)) {
    errors.guardianIdentityDocumentNum = "La cédula del representante debe tener entre 5 y 20 caracteres.";
  }

  if (!form.firstName.trim()) errors.firstName = "Ingrese el nombre del niño o niña.";
  if (!form.lastName.trim()) errors.lastName = "Ingrese el apellido del niño o niña.";
  if (form.identityDocumentNum.trim() && !isValidIdentityDocument(form.identityDocumentNum)) {
    errors.identityDocumentNum = "La cédula del niño o niña debe tener entre 5 y 20 caracteres.";
  }

  if (form.birthdate && !isValidPastDate(form.birthdate)) {
    errors.birthdate = "La fecha de nacimiento debe ser una fecha válida y no puede ser futura.";
  }

  if (form.phoneNumber.trim() && !isValidVenezuelanPhone(form.phoneNumber)) {
    errors.phoneNumber = "Ingrese un número de teléfono venezolano válido (ej. 0412-1234567).";
  }

  if (form.weight && form.weight < 0) {
    errors.weight = "Ingrese un peso válido.";
  }

  const medicationErrors: string[] = [];
  form.medications.forEach((medication, index) => {
    medicationErrors[index] = medication.name.trim() ? "" : "Ingrese el nombre del medicamento.";
  });
  if (medicationErrors.some((message) => message)) {
    errors.medications = medicationErrors;
  }

  const dietaryConstraintErrors: string[] = [];
  form.dietaryConstraints.forEach((constraint, index) => {
    if (!constraint.name.trim()) {
      dietaryConstraintErrors[index] = "Ingrese el nombre de la restricción.";
    } else if (!constraint.cannotEat.some((food) => food.trim())) {
      dietaryConstraintErrors[index] = "Ingrese al menos un alimento que no puede comer.";
    } else {
      dietaryConstraintErrors[index] = "";
    }
  });
  if (dietaryConstraintErrors.some((message) => message)) {
    errors.dietaryConstraints = dietaryConstraintErrors;
  }

  return errors;
}

export function hasFormErrors(errors: FormErrors): boolean {
  const { medications, dietaryConstraints, ...rest } = errors;
  return (
    Object.values(rest).some(Boolean) ||
    Boolean(medications?.some(Boolean)) ||
    Boolean(dietaryConstraints?.some(Boolean))
  );
}
