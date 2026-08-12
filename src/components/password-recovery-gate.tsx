"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RULES, isPasswordStrong } from "@/lib/password";

// Supabase's recovery email links land back on the site with the session
// tokens in the URL *hash* (#access_token=...&type=recovery), which never
// reaches the server - it survives our server-side redirect chain
// (/ -> /dashboard -> /login) because browsers carry a fragment forward
// through redirects whose Location has none of its own, so it always ends
// up here. The browser Supabase client auto-detects it on creation and
// fires PASSWORD_RECOVERY; until that happens this just renders the normal
// login form untouched.
export function PasswordRecoveryGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isRecovery, setIsRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = isPasswordStrong(password) && passwordsMatch;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setIsPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    router.push("/dashboard");
    router.refresh();
  }

  if (!isRecovery) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h1 className="mb-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Set a new password
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Choose something new for your Cat the Startup account.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            New password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="••••••••••"
            />
          </label>

          <ul className="-mt-2 flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={
                    "flex items-center gap-1.5 " +
                    (met
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-500 dark:text-zinc-400")
                  }
                >
                  <span aria-hidden>{met ? "🐾" : "·"}</span>
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirm new password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="••••••••••"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <span className="text-xs font-normal text-red-700 dark:text-red-400">
                Passwords don&apos;t match yet.
              </span>
            )}
          </label>

          <button
            type="submit"
            disabled={!canSubmit || isPending || done}
            className="mt-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving…" : done ? "Saved — redirecting…" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
