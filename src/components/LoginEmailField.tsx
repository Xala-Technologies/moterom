import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Field, Input, Label } from "./ui";

export function LoginEmailField({
  label,
  placeholder,
  recentLabel,
  value,
  suggestions,
  onChange,
  onPick,
  disabled,
}: {
  label: string;
  placeholder: string;
  recentLabel: string;
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  /** When set, choosing a suggestion also continues login (Digilist one-tap). */
  onPick?: (value: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((item) => item.includes(q));
  }, [suggestions, value]);

  const showMenu = open && matches.length > 0 && !disabled;

  useEffect(() => {
    if (!showMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [showMenu]);

  useEffect(() => {
    setActive(0);
  }, [matches.length, value]);

  const choose = (email: string) => {
    onChange(email);
    setOpen(false);
    if (onPick) {
      onPick(email);
      return;
    }
    rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showMenu) {
      if (event.key === "ArrowDown" && matches.length) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" && matches[active]) {
      event.preventDefault();
      choose(matches[active]!);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      className={`login-email-field${showMenu ? " is-open" : ""}`}
      ref={rootRef}
    >
      <Field>
        <Label htmlFor="login-email">{label}</Label>
        <Input
          id="login-email"
          name="username"
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showMenu}
          role="combobox"
          autoComplete="username"
          type="email"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoFocus
          required
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </Field>
      {showMenu ? (
        <div
          id={listId}
          className="login-email-menu"
          role="listbox"
          aria-label={recentLabel}
        >
          <p className="login-email-menu-caption">{recentLabel}</p>
          <ul className="login-email-menu-list">
            {matches.map((item, index) => (
              <li key={item} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={
                    index === active
                      ? "login-email-option is-active"
                      : "login-email-option"
                  }
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
