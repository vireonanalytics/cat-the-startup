"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestAccess } from "@/app/login/actions";
import { PASSWORD_RULES, isPasswordStrong } from "@/lib/password";
import { Mascot, type MascotPose } from "@/components/mascot";

// No pose exists for every possible feeling, so this reuses the poses that
// already read closest to each state rather than commissioning new art:
// "reviewing" (thinking, paw on chin) for "still working on it", "shy"
// (blushing, pleased) for "that's a strong password."
function passwordMascotPose(password: string, isStrong: boolean): MascotPose {
  if (password.length === 0) return "idle";
  return isStrong ? "shy" : "reviewing";
}

function passwordMascotCaption(password: string, isStrong: boolean): string {
  if (password.length === 0) return "Pick a password only you know.";
  return isStrong ? "That's a strong one!" : "Getting there…";
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
    >
      {pending ? "Sending…" : "Request access"}
    </button>
  );
}

export function RequestAccessForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const strong = isPasswordStrong(password);
  const canSubmit = strong && passwordsMatch;

  return (
    <form action={requestAccess} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Name
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName}
          autoComplete="name"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="Jane Doe"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Email
        <input
          type="email"
          name="email"
          required
          defaultValue={defaultEmail}
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="••••••••••"
        />
      </label>

      <div className="-mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Mascot pose={passwordMascotPose(password, strong)} size={32} />
        {passwordMascotCaption(password, strong)}
      </div>

      <ul className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
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
        Confirm password
        <input
          type="password"
          name="confirm_password"
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

      <SubmitButton disabled={!canSubmit} />
    </form>
  );
}
