import Link from "next/link";
import { RequestAccessForm } from "@/components/request-access-form";
import { Mascot } from "@/components/mascot";

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string; name?: string; email?: string }>;
}) {
  const params = await searchParams;
  const submitted = params.submitted === "1";

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <h1 className="mb-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Request access
        </h1>

        {submitted ? (
          <>
            <Mascot pose="shy" size={72} className="mx-auto mb-3" priority />
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Sent! We&apos;ll email you once your request has been reviewed
              — no account exists yet until then.
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Cat the Startup is invite-only. Send a request and we&apos;ll
              set you up once it&apos;s approved.
            </p>

            {params.error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {params.error}
              </div>
            )}

            <RequestAccessForm
              defaultName={params.name ?? ""}
              defaultEmail={params.email ?? ""}
            />

            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-zinc-950 underline dark:text-zinc-50"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
