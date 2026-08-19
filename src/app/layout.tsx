import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cat the Startup",
  description: "Triage inbound startups as a team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* A visible ownership mark, not a real IP protection - lives in
            the root layout (not (app)/layout.tsx) so it's on every page,
            including the pre-auth login/request-access screens someone
            evaluating the product would see first. Desktop-only: below lg,
            both bottom corners are already claimed by the mascot button and
            Cat-ch Up's own toggle (see mascot-companion.tsx /
            discussion-chat.tsx), and a phone screen has no clean spot left
            for a third fixed corner element without risking the exact kind
            of overlap those two just got fixed for. */}
        <div className="pointer-events-none fixed bottom-3 left-3 z-30 hidden select-none text-xs text-zinc-500/70 lg:block dark:text-zinc-500/60">
          A Vireon Analytics LLC product
        </div>
      </body>
    </html>
  );
}
