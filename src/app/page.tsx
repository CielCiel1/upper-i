import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* UI-SPEC "Screen 3". The authenticated home.

   STRUCTURE IS THE DELIVERABLE HERE. The page component below is synchronous and
   suspends on nothing; the only session-dependent markup lives in <Identity/>, inside
   a Suspense boundary. That placement is what makes this route a partial prerender
   (`◐` in the build table) rather than a fully dynamic one (`ƒ`) — the static shell,
   the card and the sign-out button all ship as prerendered HTML and paint while Neon's
   compute is still resuming, and only the name and email stream in afterwards.

   That is INFRA-07, and it is satisfied by where the read sits, not by any directive.
   Hoisting `auth()` up into the page body would make the whole route dynamic, and the
   build gate in this plan would fail — correctly. */

/* Reads the session. Separated purely so the suspending work has its own component:
   Suspense boundaries wait on their children, so the read must live in one. */
async function Identity() {
  const session = await auth();

  /* src/proxy.ts already keeps unauthenticated visitors off this route, so this is a
     second line rather than the first. It is here because the guard protects the route
     and this component reads the session — if those two ever disagree, the honest
     outcome is to send the visitor to sign in, not to render "Chào undefined". */
  if (!session?.user) redirect("/dang-nhap");

  /* `name` is the Google-provided display name today. AUTH-05 later makes it editable,
     and this is the line that will read the edited value — the fallback keeps the
     greeting grammatical in the window where a row exists with no name set. */
  const displayName = session.user.name ?? "bạn";

  return (
    <>
      {/* The live test for the 1.3 line-height decision: a Vietnamese name with tone
          marks (Chào, Mạnh, Hồng) clips visibly at 1.25. Never set leading-tight here. */}
      <h1 className="text-display text-ink">Chào {displayName}</h1>
      {/* Both lines are needed and prove different things. The name proves the session
          resolved and the Neon round-trip succeeded; the email proves WHICH identity
          authenticated. Without the email, a successful sign-in by the wrong Google
          account — the common case on a phone holding three of them — is
          indistinguishable from a correct one, which is exactly what allowlist testing
          needs to tell apart. */}
      <p className="text-caption text-ink-muted">{session.user.email}</p>
    </>
  );
}

/* Sized in `em` inside wrappers carrying the type token of the text each stands in for,
   per the Skeleton sizing contract. A display line is 2rem x 1.3 = 41.6px, which is not
   a multiple of the 4px spacing scale, so no h-* utility can express it: h-10 is 1.6px
   short, h-11 is 2.4px over, and either one produces the layout jump on arrival that
   the skeleton exists to prevent. */
function IdentityFallback() {
  return (
    <>
      <div className="text-display">
        <Skeleton className="h-[1.3em] w-48" />
      </div>
      <div className="text-caption">
        <Skeleton className="h-[1.4em] w-56" />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-8">
      {/* Only the identity suspends. Everything below is prerendered and present in the
          first paint. */}
      <div className="flex flex-col gap-1">
        <Suspense fallback={<IdentityFallback />}>
          <Identity />
        </Suspense>
      </div>

      <Card>
        {/* Written as a string expression rather than JSX text on purpose: the
            formatter rewraps bare JSX text across lines, and this copy is a verbatim
            contract from the UI-SPEC that is checked by an exact-match grep. A string
            literal cannot be broken, so the contract and the formatter stop fighting. */}
        <p className="text-body text-ink-soft">
          {
            "Nhóm đã sẵn sàng. Tính năng ghi chi tiêu sẽ có ở bản cập nhật tiếp theo."
          }
        </p>
      </Card>

      {/* AUTH-06 for this screen. Outside the boundary on purpose: it carries no session
          data, so it has no reason to wait for one. */}
      <SignOutButton />

      {/* Deliberately absent, and not an oversight: no money, no navigation, no tab bar,
          no FAB, no settings. Phase 1 ships no transaction surface of any kind. */}
    </div>
  );
}
