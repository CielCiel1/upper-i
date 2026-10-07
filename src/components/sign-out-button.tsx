import { SubmitButton } from "@/components/ui/submit-button";
import { signOutAction } from "@/lib/auth-actions";

/* AUTH-06. A form posting to the sign-out server action, same reasoning as the
   sign-in button: it works before hydration, and because it holds no session data it
   never forces its container to render dynamically. That last part matters here more
   than it looks — this button sits OUTSIDE the Suspense boundary on the home page,
   so if it carried session state it would drag the whole static shell with it.

   The label is a prop because the rejection screen reuses this component with
   different wording. Only the wording differs; the action is identical. */
export function SignOutButton({ label = "Đăng xuất" }: { label?: string }) {
  return (
    <form action={signOutAction} className="w-full">
      {/* U+2026 — a real ellipsis, matching the UI-SPEC copy table. */}
      <SubmitButton variant="bordered" pendingLabel="Đang đăng xuất…">
        {label}
      </SubmitButton>
    </form>
  );
}
