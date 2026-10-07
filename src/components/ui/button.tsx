import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "bordered";
  /* True while the enclosing form's submission is in flight. Server-action forms
     have no client handler to flip state, so this value comes from React's
     useFormStatus — see SubmitButton, which is the only correct way to source it. */
  pending?: boolean;
  /* Label shown while pending. Keep it close in length to the idle label: the button
     must not change width mid-submission or the layout jumps under the user's thumb. */
  pendingLabel?: ReactNode;
};

/* A real <button>, never a clickable div. The native element brings a tab stop,
   Enter/Space activation and an implicit role for free; a div needs three separate
   additions to approximate that and each one is a chance to get it wrong.

   Never add a focus-suppressing class here. The global :focus-visible ring from
   globals.css applies, and its 2px offset already clears the control radius. */
export function Button({
  variant = "bordered",
  pending = false,
  pendingLabel,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "bg-accent text-on-accent border border-accent"
      : "bg-surface-raised text-ink border border-border-strong";

  return (
    <button
      /* min-h-12 (48px) sits above the 44px touch minimum for comfort.
         Disabling on first submit also stops a double-tap on flaky mobile data
         from firing a second request. */
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-control px-4 text-body font-semibold disabled:opacity-60 ${variantClasses} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending}
      {...props}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
