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
            evaluating the product would see first. A true footer in normal
            flow (mt-auto against the body's own flex-col, not
            position:fixed) - it sits at the bottom of short pages and
            scrolls away below long ones, rather than floating over content
            the whole time. */}
        <footer className="mt-auto shrink-0 px-4 py-3 text-center text-xs text-zinc-500/70 dark:text-zinc-500/60">
          © 2026 Vireon Analytics LLC. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
