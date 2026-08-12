import Link from "next/link";
import { signIn } from "./actions";
import { PasswordRecoveryGate } from "@/components/password-recovery-gate";
import { Mascot } from "@/components/mascot";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirectTo ?? "/dashboard";

  return (
    <PasswordRecoveryGate>
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="group w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {/* Pure CSS (:focus-within via Tailwind's group-focus-within), no
              client component needed - the cat swaps from idle to a
              "thinking it over" pose while either field below has focus, by
              stacking both poses and crossfading their opacity, the same
              way the two logged-out pages otherwise have no reason to ship
              any client JS at all. */}
          <div className="relative mx-auto mb-4 h-16 w-16">
            <div className="absolute inset-0 opacity-100 transition-opacity duration-300 group-focus-within:opacity-0">
              <Mascot pose="idle" size={64} priority />
            </div>
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100">
              <Mascot pose="reviewing" size={64} priority />
            </div>
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Cat the Startup
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Sign in with your team email and password.
          </p>

          {params.error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {params.error}
            </div>
          )}

          <form action={signIn} className="flex flex-col gap-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="you@fund.com"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              className="mt-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/request-access"
              className="font-medium text-zinc-950 underline dark:text-zinc-50"
            >
              Request access
            </Link>
          </p>
        </div>
      </div>
    </PasswordRecoveryGate>
  );
}
