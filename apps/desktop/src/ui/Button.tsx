import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "small" | "medium";
  /** Shown in place of the label while an action runs; the button is disabled meanwhile. */
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "medium", busy = false, icon, className, children, disabled, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={["btn", `btn--${variant}`, size === "small" && "btn--small", className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="btn__spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

type IconProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: an icon button has no visible text. */
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className, children, type = "button", ...rest }: IconProps) {
  return (
    <button type={type} className={["icon-btn", className].filter(Boolean).join(" ")} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
