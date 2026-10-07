import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { isPlausibleEmail } from "@/lib/allowlist";

/* UI-SPEC "Screen 2". The rejection screen.

   TONE IS A HARD CONSTRAINT, and it is easy to violate by reflex. No red, no warning
   icon, no error styling anywhere on this page. Nothing went wrong: the system worked
   exactly as designed and this person simply has not been invited yet. Red would tell
   them they did something wrong, and they did not. Ordinary ink on a plain card.

   The same reasoning is why the copy says `chưa được mời` — "not yet invited", a
   reversible administrative state — rather than `bị từ chối` or `không có quyền`,
   both of which read as an accusation. */

/* The URL of this page carries an email address in its query string, which means the
   address would ride along in the `Referer` header of any outbound request this page
   initiates. Phase 1 loads nothing third-party, so the exposure right now is zero —
   the policy is here so that a later phase adding an analytics script or an embedded
   image to the shared layout cannot silently open the leak without noticing. */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

/* A conservative plausibility check, not validation in any meaningful sense.

   This value is attacker-craftable: anyone can type the URL with anything in it. The
   job is narrow — if it does not look like an email address, do not echo it back at
   all. React interpolates it as text content, never as markup, so the residual risk is
   a confusing page rather than injection.

   254 is the RFC 5321 maximum for an address, so anything longer is not a truncated
   real address — it is someone trying to render a paragraph of their own text inside
   our sentence. */
function plausibleEmail(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 254) return null;

  /* Dùng CHUNG định nghĩa với allowlist thay vì giữ một regex riêng ở đây.
     Trước đây hai đầu bất đồng về "cái gì là email": allowlist không áp hình
     dạng nào cả, nên tồn tại địa chỉ vừa là thành viên hợp lệ vừa bị trang này
     từ chối, và người đó thấy câu chữ xuống cấp "Tài khoản này…" thay vì địa
     chỉ của chính mình. Cùng kiểu trôi lệch mà normalizeEmail sinh ra để ngăn. */
  if (!isPlausibleEmail(value)) return null;
  return value;
}

/* Reads the query string, so it must live inside the Suspense boundary: the project
   builds with cached components enabled, which makes a search-param read outside one a
   hard build failure rather than a warning. */
async function Explanation({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  /* ENTRY CONTRACT, set by the signIn callback in src/auth.ts:
     `/chua-duoc-moi?error=AccessDenied&email=<encoded>`.

     This route is deliberately excluded from the route guard, because a refused
     visitor has no session and still has to be able to reach it. That exclusion is
     also what lets anyone type the URL directly. Without this check the page shows a
     "you are not invited" message to people who never attempted to sign in, and
     reflects whatever address a visitor puts in the URL back at themselves.

     This is NOT an authentication boundary and must not be mistaken for one — the
     marker carries no secret and is trivial to forge. Its job is to stop accidental
     and casual arrival at a confusing page, which is the realistic failure. */
  if (params.error !== "AccessDenied") redirect("/dang-nhap");

  const email = plausibleEmail(params.email);

  return (
    <p className="text-body text-ink-soft">
      {email ? (
        /* Split into string expressions around the <strong> rather than left as bare
           JSX text, so the formatter cannot rewrap the verbatim sentence mid-phrase. */
        <>
          {"Tài khoản "}
          <strong>{email}</strong>
          {" chưa có trong danh sách thành viên của nhóm."}
        </>
      ) : (
        /* Degraded wording for the case where the address is missing or implausible.
           Echoing arbitrary text back would be worse than losing the detail. */
        <>Tài khoản này chưa có trong danh sách thành viên của nhóm.</>
      )}
    </p>
  );
}

export default function AccessDeniedPage({
  searchParams,
}: PageProps<"/chua-duoc-moi">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-8">
      <Card>
        <div className="flex flex-col gap-4">
          {/* The page's single h1. */}
          <h1 className="text-heading text-ink">Email này chưa được mời</h1>

          <Suspense fallback={null}>
            <Explanation searchParams={searchParams} />
          </Suspense>

          {/* Static: a path forward, and a human one, which is correct — adding a
              member is an INSERT that someone has to run.

              String expression, not bare JSX text: the formatter rewraps the latter,
              and this copy is a verbatim UI-SPEC contract checked by exact-match grep. */}
          <p className="text-body text-ink-soft">
            {
              "Nếu bạn nghĩ đây là nhầm lẫn, nhắn cho người quản lý nhóm để được thêm vào."
            }
          </p>
        </div>
      </Card>

      {/* Same component, same action, different label. "Dùng tài khoản khác" names the
          user's actual goal; telling someone to sign out of an account they were just
          told is not welcome is confusing phrasing. A refused visitor has no session,
          so the sign-out is a no-op server-side — its real effect is clearing the
          Google account selection and returning them to the sign-in screen. */}
      <SignOutButton label="Dùng tài khoản khác" />
    </div>
  );
}
