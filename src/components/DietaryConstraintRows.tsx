import type { DietaryConstraint } from "../types";

interface DietaryConstraintRowsProps {
  constraints: DietaryConstraint[];
  errors?: string[];
  onChange: (constraints: DietaryConstraint[]) => void;
}

const EMPTY_CONSTRAINT: DietaryConstraint = { name: "", cannotEat: [] };

export function DietaryConstraintRows({ constraints, errors, onChange }: DietaryConstraintRowsProps) {
  function updateName(index: number, name: string) {
    const next = constraints.map((constraint, i) => (i === index ? { ...constraint, name } : constraint));
    onChange(next);
  }

  function updateFood(index: number, foodIndex: number, value: string) {
    const next = constraints.map((constraint, i) => {
      if (i !== index) return constraint;
      const cannotEat = constraint.cannotEat.map((food, j) => (j === foodIndex ? value : food));
      return { ...constraint, cannotEat };
    });
    onChange(next);
  }

  function addFood(index: number) {
    const next = constraints.map((constraint, i) =>
      i === index ? { ...constraint, cannotEat: [...constraint.cannotEat, ""] } : constraint
    );
    onChange(next);
  }

  function removeFood(index: number, foodIndex: number) {
    const next = constraints.map((constraint, i) =>
      i === index ? { ...constraint, cannotEat: constraint.cannotEat.filter((_, j) => j !== foodIndex) } : constraint
    );
    onChange(next);
  }

  function addRow() {
    onChange([...constraints, { ...EMPTY_CONSTRAINT, cannotEat: [] }]);
  }

  function removeRow(index: number) {
    onChange(constraints.filter((_, i) => i !== index));
  }

  return (
    <div className="dietary-constraints">
      {constraints.map((constraint, index) => (
        <div className="dietary-constraint-row" key={index}>
          <div className="field">
            <label htmlFor={`dietary-name-${index}`}>Restricción</label>
            <input
              id={`dietary-name-${index}`}
              type="text"
              placeholder="Ej. Celiaquía"
              value={constraint.name}
              onChange={(e) => updateName(index, e.target.value)}
            />
            {errors?.[index] && <span className="field-error">{errors[index]}</span>}
          </div>

          <div className="dietary-foods">
            <span className="dietary-foods-label">Alimentos que no puede comer</span>
            {constraint.cannotEat.map((food, foodIndex) => (
              <div className="dietary-food-item" key={foodIndex}>
                <input
                  type="text"
                  aria-label={`Alimento ${foodIndex + 1}`}
                  placeholder="Ej. Pan"
                  value={food}
                  onChange={(e) => updateFood(index, foodIndex, e.target.value)}
                />
                <button
                  type="button"
                  className="button-remove"
                  onClick={() => removeFood(index, foodIndex)}
                  aria-label="Eliminar alimento"
                >
                  Eliminar
                </button>
              </div>
            ))}
            <button type="button" className="button-secondary" onClick={() => addFood(index)}>
              + Agregar alimento
            </button>
          </div>

          <button
            type="button"
            className="button-remove"
            onClick={() => removeRow(index)}
            aria-label="Eliminar restricción"
          >
            Eliminar restricción
          </button>
        </div>
      ))}
      <button type="button" className="button-secondary" onClick={addRow}>
        + Agregar restricción
      </button>
    </div>
  );
}
