import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/* `subsets: ['vietnamese']` is non-negotiable. Without it U+20AB (₫) and the
   U+1EA0–U+1EF9 tone-mark block fall through to the system font, producing
   mixed-typeface money strings. next/font self-hosts the file at build time,
   so there is no runtime request to a font CDN on flaky 4G. */
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Upper-I",
  description: "Chia tiền và theo dõi nợ cho nhóm bạn",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* REQUIRED — without it every env(safe-area-inset-*) evaluates to 0 and the
     shell geometry silently collapses to a non-notched layout.
     Do NOT cap or disable user scaling here: the 16px input floor in globals.css
     already solves zoom-on-focus, and blocking pinch-zoom is a WCAG 1.4.4 failure. */
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0A09" },
  ],
};

/* INFRA-07: this file is synchronous end to end — it suspends on nothing, reads no
   session and imports no database module. The shell is therefore prerenderable at
   build time and paints in a single frame while Neon's compute is still resuming.
   The session is read inside the page instead, wrapped in Suspense.
   Were the shell to block on the session, it would block on the cold start too, and
   INFRA-07 would be unreachable no matter what the pages do. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* lang="vi" drives screen-reader pronunciation and browser hyphenation. */
    <html lang="vi" className={inter.variable}>
      <body className="min-h-dvh bg-surface text-ink font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <header
            className="flex shrink-0 items-center justify-between border-b border-border bg-surface-raised px-[var(--shell-gutter)]"
            style={{
              /* Total height GROWS by the safe-area inset so the 56px content box is
                 preserved. `h-14` + paddingTop would SUBTRACT the notch from the 56px:
                 on an iPhone 16 Pro (inset 59px) that computes to -3px and the header
                 collapses. This rule binds every bar added in any later phase. */
              height:
                "calc(var(--shell-header-content) + var(--shell-safe-top))",
              paddingTop: "var(--shell-safe-top)",
            }}
          >
            <span className="text-heading text-accent">Upper-I</span>
            {/* Phase 3+: avatar / account menu mounts here */}
            <div className="min-h-[var(--size-touch-min)] min-w-[var(--size-touch-min)]" />
          </header>

          <main
            className="flex-1 px-[var(--shell-gutter)]"
            style={{
              /* --shell-tabbar-height ALREADY includes --shell-safe-bottom, so it is
                 used alone here. Adding the inset again would double-count it and
                 leave a dead gap under every screen.
                 Today: 0px + safe-bottom. Phase 3: 56px + safe-bottom. */
              paddingBottom: "var(--shell-tabbar-height)",
            }}
          >
            {children}
          </main>

          {/* Phase 3: <BottomTabBar /> mounts here — Số dư / Lịch sử / Nhóm */}
        </div>
      </body>
    </html>
  );
}
