"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  name: string;
  autoComplete: string;
  /** Shown above the field. Leave out when the field has only a placeholder and an aria-label. */
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  minLength?: number;
};

/**
 * A password input with a show and hide button. It is one ordinary input inside the page's form, so
 * submitting works exactly as before. The button never submits, and the field hides itself again when
 * the form is sent so a password does not stay visible if someone comes back to the page.
 */
export default function PasswordField({ name, autoComplete, label, placeholder, ariaLabel, required, minLength }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrap.current?.closest("form");
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  const field = (
    <div className="pw" ref={wrap}>
      <input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={label ? undefined : ariaLabel}
        required={required}
        minLength={minLength}
        className="field"
        // Stops phone keyboards from capitalising or "correcting" a password while it is visible.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={id}
      >
        {shown ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-3.17 4.19M6.61 6.61A17.4 17.4 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M2 2l20 20" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );

  if (!label) return field;
  return (
    <div className="label-group">
      <label className="label" htmlFor={id}>{label}</label>
      {field}
    </div>
  );
}
