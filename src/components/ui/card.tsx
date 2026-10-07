import type { ReactNode } from "react";

/* Raised surface container. In dark mode --shadow-card resolves to `none` and the
   depth comes from surface-raised being lighter than surface — no component change. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card">
      {children}
    </div>
  );
}
