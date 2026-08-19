import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { MascotProvider } from "@/components/mascot-context";
import { MascotCompanion, MascotMobileButton } from "@/components/mascot-companion";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
import { MobileNavProvider } from "@/components/mobile-nav-context";
import { ProductTour } from "@/components/product-tour";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("role, tour_completed")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  // The tour's startup-detail steps need a real startup to land on - rather
  // than wait for the analyst to open one themselves, it drives straight to
  // this one (a real deck with a full review/research/evidence trail, so
  // every step actually has something to point at). Only queried when the
  // tour might still run - an analyst who's already finished it never pays
  // for this lookup. Exact name match, not a prefix - "LinkedIn Series B
  // Pitch Deck 2004" is a leftover duplicate from an earlier bad upload
  // that got passed on, and a bare ilike prefix match with no ORDER BY has
  // no guaranteed row order, so it was liable to land on that dead one
  // instead of the real "LinkedIn" startup still active on the dashboard.
  // Excluding "passed" is an extra guard against ever pointing the tour at
  // a graveyarded startup, even if more duplicates show up later.
  const { data: tourStartup } = profile && !profile.tour_completed
    ? await supabase
        .from("startups")
        .select("id")
        .eq("name", "LinkedIn")
        .neq("status", "passed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <MobileNavProvider>
      <MascotProvider>
        <div className="paw-pattern-bg flex flex-1 flex-col bg-zinc-50 dark:bg-black">
          <header className="sticky top-0 z-40 border-b border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
            {/* Full-width, no max-w/mx-auto - the nav group (brand+links)
                and the account group are pinned to the two true edges via
                justify-between, with px-6/8 giving them normal page-margin
                spacing rather than both clusters sitting inside a narrower
                centered box (which read as a big empty band down the middle
                on wide screens, and equally large empty margins outside it).
                Below md there isn't room for the brand, four links, an
                email, and a Sign out button on one line without wrapping or
                crowding - the links and account group hide there (each
                still a real flex participant with zero rendered width, so
                justify-between still pins the brand and MobileNavMenu to
                the true edges - see the comment in mobile-nav-menu.tsx) in
                favor of MobileNavMenu's single hamburger toggle, which does
                the opposite (`md:hidden`). */}
            <div className="flex w-full items-center justify-between px-6 py-4 lg:px-8">
              <nav className="flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className="text-lg font-bold text-zinc-950 dark:text-zinc-50"
                >
                  Cat the Startup
                </Link>
                <span className="hidden items-center gap-6 md:flex">
                  <Link
                    href="/dashboard"
                    className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/startups/new"
                    className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Add startup
                  </Link>
                  <Link
                    href="/passed"
                    data-tour="passed-link"
                    className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Passed
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin/requests"
                      className="text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      Requests
                    </Link>
                  )}
                </span>
              </nav>

              <div className="hidden items-center gap-4 md:flex">
                {user?.email && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </span>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Sign out
                  </button>
                </form>
              </div>

              <MobileNavMenu isAdmin={isAdmin} userEmail={user?.email ?? null} />
            </div>
          </header>

          {/* No max-w/mx-auto - same reasoning as the header. main is a real
              flex-1 column: it fills whatever width is left after the aside's
              fixed reservation, so it grows to use freed-up space rather than
              staying a fixed width with a growing gap next to it. */}
          <div className="flex w-full flex-1 gap-6 px-6 py-8 lg:px-8">
            {/* pb-28 below lg only - below that breakpoint the mascot rail
                isn't a reserved column anymore, it's MascotMobileButton and
                Cat-ch Up's own mobile toggle, both `fixed` in the bottom
                corners (see mascot-companion.tsx / discussion-chat.tsx).
                Without this, page content that happens to scroll to exactly
                that height renders underneath them - not just visually, they
                actually intercept clicks (confirmed: a deck's "Upload deck"
                button was unclickable through the cat FAB). The reserved
                column at lg+ doesn't have this problem by construction, so
                no extra padding is needed there. */}
            <main className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</main>

            {/* Reserved at its full w-80 - matching the chat panels' own
                width (see analyst-cat-chat.tsx / discussion-chat.tsx), not
                just the narrower cat - so main's flex-1 box always leaves
                enough room for whichever is showing, cat alone or a panel
                too. A structural reservation, not independently-set margins
                on each side that can drift out of sync and collide (that's
                what caused the panels to overlap the review card last
                round: main was sized around the cat's own width while the
                wider panels still escaped past it via `fixed` positioning).
                Hidden below lg since there's no room to reserve a column at
                all on narrower viewports - see MascotMobileButton instead. */}
            <aside className="hidden w-80 shrink-0 lg:block">
              {/* Sticky, not fixed - a real flex/grid item now that the
                  column's width is genuinely reserved from main, so its
                  right edge is just wherever this column naturally sits in
                  the row (flush against the row's own px-6/8 gutter) rather
                  than a viewport-relative offset computed to approximate
                  that. The explicit height keeps this column's own flex
                  children (cat, then the AI chat panel taking whatever's
                  left, then Cat-ch Up pinned last) bounded to roughly one
                  viewport's worth of space, so they still share it by CSS
                  alone instead of ever overlapping each other vertically -
                  same idea as the old `fixed top-24 bottom-5`, just derived
                  from `sticky`'s own box instead of the viewport directly. */}
              <div className="sticky top-24 flex h-[calc(100vh-7.25rem)] flex-col items-end gap-2">
                <div className="flex w-44 shrink-0 flex-col items-center self-end">
                  <MascotCompanion />
                </div>
                <div id="analyst-chat-anchor" className="flex min-h-0 w-72 flex-1 flex-col self-end" />
                <div id="discussion-chat-anchor" className="flex w-72 shrink-0 flex-col self-end" />
              </div>
            </aside>
          </div>

          {/* The mobile equivalent of the rail above - a sibling of the
              `aside`, not nested inside it, since the aside's own `hidden
              lg:block` would otherwise hide this too regardless of its own
              `lg:hidden` (a `display:none` ancestor hides everything inside
              it no matter what a descendant's own CSS says). */}
          <MascotMobileButton />

          <ProductTour
            initialCompleted={profile?.tour_completed ?? true}
            tourStartupId={tourStartup?.id ?? null}
          />
        </div>
      </MascotProvider>
    </MobileNavProvider>
  );
}
