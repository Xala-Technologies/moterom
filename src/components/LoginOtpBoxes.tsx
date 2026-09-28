import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

/**
 * Digilist-style 6-cell OTP: one real `one-time-code` field overlaid on
 * decorative digit boxes (autofill + keyboard stay on a single input).
 */
export function LoginOtpBoxes({
  value,
  onChange,
  disabled,
  error,
  label,
  id = "login-otp",
}: {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  error?: boolean;
  label: string;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  return (
    <div className="login-otp">
      <label className="login-otp-label" htmlFor={id}>
        {label}
      </label>
      <div className="login-otp-field">
        <input
          ref={inputRef}
          id={id}
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="done"
          maxLength={CODE_LENGTH}
          pattern="[0-9]{6}"
          disabled={disabled}
          required
          className="login-otp-entry"
          aria-label={label}
          aria-invalid={error || undefined}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) =>
            onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
        />
        <div
          className={[
            "login-otp-row",
            focused ? "is-focused" : "",
            error ? "is-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
          onClick={() => inputRef.current?.focus()}
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const digit = value[i] ?? "";
            const isActive = focused && !error && i === value.length;
            return (
              <div
                key={i}
                className={[
                  "login-otp-digit",
                  error ? "is-error" : "",
                  !error && digit ? "is-filled" : "",
                  isActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {digit}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
