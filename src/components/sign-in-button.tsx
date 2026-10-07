import { GoogleMark } from "@/components/google-mark";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInWithGoogle } from "@/lib/auth-actions";

/* A plain <form> posting to a server action, NOT a client component with onClick.

   This is the control a user on 4G at a restaurant taps first, and a form action is
   live the moment the HTML lands — it does not wait for the JS bundle to download and
   hydrate. An onClick handler would be dead until then, on exactly the connection
   where "then" is slowest.

   It also keeps this component server-rendered, so the sign-in page carries no client
   session state and stays fully static.

   SubmitButton (not Button) and rendered INSIDE the form: useFormStatus only reports
   pending from a child of the form element. Lifted out, it returns false forever and
   the pending label silently never appears. */
export function SignInButton() {
  return (
    <form action={signInWithGoogle} className="w-full">
      <SubmitButton
        variant="bordered"
        pendingLabel={
          <>
            <GoogleMark />
            {/* U+2026 — a real ellipsis, matching the UI-SPEC copy table. */}
            Đang chuyển tới Google…
          </>
        }
      >
        <GoogleMark />
        Đăng nhập với Google
      </SubmitButton>
    </form>
  );
}
