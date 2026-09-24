export type RegistrationFieldType = "text" | "checkbox";

export interface RegistrationField {
  id: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
}

export type RegistrationAnswerValue = string | boolean;
export type RegistrationAnswerState = Record<string, RegistrationAnswerValue>;

export interface RegistrationAnswer {
  fieldId: string;
  value: RegistrationAnswerValue;
}

export function validateRegistrationAnswers(
  fields: RegistrationField[],
  answers: RegistrationAnswerState
): string | null {
  for (const field of fields) {
    if (!field.required) continue;

    const value = answers[field.id];
    if (field.type === "checkbox" && value !== true) {
      return `Please check “${field.label}” to continue`;
    }
    if (field.type === "text" && (typeof value !== "string" || !value.trim())) {
      return `Please answer “${field.label}”`;
    }
  }

  return null;
}

export function serializeRegistrationAnswers(
  fields: RegistrationField[],
  answers: RegistrationAnswerState
): RegistrationAnswer[] {
  return fields.map((field) => {
    const answer = answers[field.id];
    return {
      fieldId: field.id,
      value:
        field.type === "checkbox"
          ? answer === true
          : typeof answer === "string"
            ? answer.trim()
            : "",
    };
  });
}
