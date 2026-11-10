import { useId, type KeyboardEventHandler, type ReactNode, type Ref } from "react";
import { NavIcon } from "./NavIcon";
import "./Fields.css";

type Option<T extends string> = { value: T; label: string };

/** A native select, so keyboard and screen reader behaviour come for free; only its look is ours. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  disabled = false,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <span className="field">
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : "field__label"}>
        {label}
      </label>
      <span className="select">
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <NavIcon name="chevron" size={14} className="select__chevron" />
      </span>
    </span>
  );
}

export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  inputRef,
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <span className="search-input">
      <NavIcon name="search" size={16} className="search-input__icon" />
      <input ref={inputRef} onKeyDown={onKeyDown} type="search" aria-label={label} placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} />
    </span>
  );
}

export type Chip<T extends string> = { id: T; label: ReactNode };

/** Toggles any number of filters on and off; an empty selection means no filter. */
export function FilterChips<T extends string>({
  label,
  chips,
  selected,
  onChange,
}: {
  label: string;
  chips: Chip<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {chips.map((chip) => {
        const on = selected.includes(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            className="chips__chip"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== chip.id) : [...selected, chip.id])}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off setting with its explanation underneath. */
export function Toggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle" data-disabled={disabled || undefined}>
      <input type="checkbox" className="toggle__input" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle__switch" aria-hidden="true" />
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
    </label>
  );
}
