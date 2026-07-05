export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

export interface RegistrationFormData {
  guardianFirstName: string;
  guardianLastName: string;
  guardianIdentityDocumentNum: string;
  firstName: string;
  lastName: string;
  identityDocumentNum: string;
  birthdate: string;
  phoneNumber: string;
  residenceZone: string;
  condition: string;
  medications: Medication[];
}

export type FormErrors = Partial<Record<Exclude<keyof RegistrationFormData, "medications">, string>> & {
  medications?: string[];
};

export interface SubmitRegistrationSuccess {
  success: true;
  childId: string;
}

export interface SubmitRegistrationError {
  error: string;
}
