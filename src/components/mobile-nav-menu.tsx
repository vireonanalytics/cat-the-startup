"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";

const LINK_CLASS =
  "rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

// The header's nav links + account group hide below md (see
// (app)/layout.tsx) - at that width there isn't room for "Cat the
// Startup" plus four links plus an email plus a Sign out button on one
// line without wrapping or crowding, and shrinking the font only pushes
// where that breaking point happens rather than fixing it. This is what
// replaces them: a single hamburger toggle, same click-outside-to-close
// pattern as the founders popover (startup-header.tsx).
export function MobileNavMenu({
  isAdmin,
  userEmail,
}: {
  isAdmin: boolean;
  userEmail: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-lg text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <nav className="flex flex-col">
              <Link href="/dashboard" onClick={close} className={LINK_CLASS}>
                Dashboard
              </Link>
              <Link
                href="/startups/new"
                onClick={close}
                data-tour="add-startup-link"
                className={LINK_CLASS}
              >
                Add startup
              </Link>
              <Link
                href="/passed"
                onClick={close}
                data-tour="passed-link"
                className={LINK_CLASS}
              >
                Passed
              </Link>
              {isAdmin && (
                <Link href="/admin/requests" onClick={close} className={LINK_CLASS}>
                  Requests
                </Link>
              )}
            </nav>

            {userEmail && (
              <p className="mt-2 truncate border-t border-black/10 px-3 pt-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                {userEmail}
              </p>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className={LINK_CLASS + " w-full text-left"}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
