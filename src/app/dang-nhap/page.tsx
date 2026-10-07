import { SignInButton } from "@/components/sign-in-button";

/* UI-SPEC "Screen 1". Fully static by construction: this file suspends on nothing,
   reads no session and imports no database module. That is not an optimisation — it is
   the whole point. This is the first thing a user on mobile data sees, and nothing on
   this page has any reason to wait on a server round-trip before painting.

   Keep it that way: a single asynchronous read added here turns the phase's fastest
   screen into one that blocks on Neon's cold start. The automated gate for this plan
   asserts the file is free of them.

   The guard in src/proxy.ts leaves this route public, so an unauthenticated visitor
   reaches it directly. */
export default function SignInPage() {
  return (
    /* min-h-full against the shell's flex-1 <main>, so "vertically centred" means
       centred in the space the header leaves, not in the viewport the header overlaps. */
    <div className="flex min-h-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* 48px (gap-12) from the wordmark block to the button, per the spec. */}
        <div className="mb-12 flex flex-col items-center gap-3">
          <h1 className="text-display text-accent">Upper-I</h1>
          {/* max-w-[28ch] keeps the line measure comfortable; the ch unit tracks the
              font so the wrap point survives a type-scale change. */}
          <p className="max-w-[28ch] text-center text-body text-ink-soft">
            Chia tiền nhóm, số dư luôn đúng.
          </p>
        </div>

        <SignInButton />

        {/* 24px (mt-6) from button to footnote, per the spec.

            This footnote is not filler and must not be trimmed as redundant: it states
            the membership rule BEFORE the tap, so a refusal afterwards reads as
            confirmation of something already said rather than as a surprise failure. */}
        <p className="mt-6 max-w-[32ch] text-center text-caption text-ink-muted">
          Chỉ thành viên trong nhóm mới đăng nhập được.
        </p>
      </div>
    </div>
  );
}
