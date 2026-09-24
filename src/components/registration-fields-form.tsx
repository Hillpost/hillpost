import type {
  RegistrationAnswerState,
  RegistrationField,
} from "@/lib/registration";

interface RegistrationFieldsFormProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  fields: RegistrationField[];
  answers: RegistrationAnswerState;
  onChange: (answers: RegistrationAnswerState) => void;
  disabled?: boolean;
}

export function RegistrationFieldsForm({
  displayName,
  onDisplayNameChange,
  fields,
  answers,
  onChange,
  disabled = false,
}: RegistrationFieldsFormProps) {
  return (
    <div className="space-y-4 border-t border-[#1F1F1F] pt-4">
      <div>
        <p className="text-xs font-bold text-[#555555] uppercase tracking-widest">
          Registration details
        </p>
        <p className="mt-1 text-[10px] text-[#333333] uppercase tracking-wider">
          Fields marked with * are required.
        </p>
      </div>

      <div>
        <label
          htmlFor="registration-display-name"
          className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest"
        >
          Display name <span className="text-[#FF6600]">*</span>
        </label>
        <input
          id="registration-display-name"
          type="text"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          disabled={disabled}
          required
          maxLength={80}
          placeholder="Your name"
          className="tui-input"
        />
        <p className="mt-1 text-[10px] text-[#333333] uppercase tracking-wider">
          This is the name other participants will see.
        </p>
      </div>

      {fields.map((field) => {
        const inputId = `registration-${field.id}`;
        const answer = answers[field.id];

        if (field.type === "checkbox") {
          return (
            <label
              key={field.id}
              htmlFor={inputId}
              className="flex cursor-pointer items-start gap-3 border border-[#1F1F1F] bg-black p-3 text-xs text-[#555555] transition-colors hover:border-[#555555]"
            >
              <input
                id={inputId}
                type="checkbox"
                checked={answer === true}
                onChange={(event) =>
                  onChange({ ...answers, [field.id]: event.target.checked })
                }
                disabled={disabled}
                required={field.required}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#00FF41]"
              />
              <span className="leading-relaxed text-white">
                {field.label}
                {field.required && <span className="ml-1 text-[#FF6600]">*</span>}
              </span>
            </label>
          );
        }

        return (
          <div key={field.id}>
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-xs font-bold text-[#555555] uppercase tracking-widest"
            >
              {field.label}
              {field.required && <span className="ml-1 text-[#FF6600]">*</span>}
            </label>
            <input
              id={inputId}
              type="text"
              value={typeof answer === "string" ? answer : ""}
              onChange={(event) =>
                onChange({ ...answers, [field.id]: event.target.value })
              }
              disabled={disabled}
              required={field.required}
              maxLength={2000}
              className="tui-input"
            />
          </div>
        );
      })}
    </div>
  );
}
