import type { Medication } from "../types";

interface MedicationRowsProps {
  medications: Medication[];
  errors?: string[];
  onChange: (medications: Medication[]) => void;
}

const EMPTY_MEDICATION: Medication = { name: "", dosage: "", frequency: "" };

export function MedicationRows({ medications, errors, onChange }: MedicationRowsProps) {
  function updateRow(index: number, field: keyof Medication, value: string) {
    const next = medications.map((medication, i) =>
      i === index ? { ...medication, [field]: value } : medication
    );
    onChange(next);
  }

  function addRow() {
    onChange([...medications, { ...EMPTY_MEDICATION }]);
  }

  function removeRow(index: number) {
    onChange(medications.filter((_, i) => i !== index));
  }

  return (
    <div className="medications">
      {medications.map((medication, index) => (
        <div className="medication-row" key={index}>
          <div className="field">
            <label htmlFor={`medication-name-${index}`}>Nombre</label>
            <input
              id={`medication-name-${index}`}
              type="text"
              value={medication.name}
              onChange={(e) => updateRow(index, "name", e.target.value)}
            />
            {errors?.[index] && <span className="field-error">{errors[index]}</span>}
          </div>
          <div className="field">
            <label htmlFor={`medication-dosage-${index}`}>Dosis</label>
            <input
              id={`medication-dosage-${index}`}
              type="text"
              value={medication.dosage}
              onChange={(e) => updateRow(index, "dosage", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`medication-frequency-${index}`}>Frecuencia</label>
            <input
              id={`medication-frequency-${index}`}
              type="text"
              value={medication.frequency}
              onChange={(e) => updateRow(index, "frequency", e.target.value)}
            />
          </div>
          <button
            type="button"
            className="button-remove"
            onClick={() => removeRow(index)}
            aria-label="Eliminar medicamento"
          >
            Eliminar
          </button>
        </div>
      ))}
      <button type="button" className="button-secondary" onClick={addRow}>
        + Agregar medicamento
      </button>
    </div>
  );
}
