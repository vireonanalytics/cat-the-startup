import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupRequestActions } from "@/components/signup-request-actions";
import { Mascot } from "@/components/mascot";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SignupRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; approved?: string; rejected?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect(`/dashboard?error=${encodeURIComponent("Admins only.")}`);
  }

  const { data: pending } = await supabase
    .from("signup_requests")
    .select("id, name, email, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: decided } = await supabase
    .from("signup_requests")
    .select("id, name, email, status, decided_at")
    .neq("status", "pending")
    .order("decided_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Access requests
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Approving creates the account immediately - nothing exists until then.
      </p>

      {params.error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {params.error}
        </div>
      )}
      {params.approved === "1" && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Account created.
        </div>
      )}
      {params.rejected === "1" && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Request rejected.
        </div>
      )}

      <div className="mt-6">
        {!pending || pending.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <Mascot pose="idle" size={80} className="mb-3" priority />
            <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              No pending requests.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {request.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {request.email} · requested {formatDate(request.created_at)}
                  </p>
                </div>
                <SignupRequestActions requestId={request.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {decided && decided.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recently decided
          </h2>
          <ul className="flex flex-col gap-2">
            {decided.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/5 bg-white px-4 py-2.5 text-sm dark:border-white/5 dark:bg-zinc-950"
              >
                <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                  {request.name}{" "}
                  <span className="text-zinc-400 dark:text-zinc-500">
                    ({request.email})
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-medium " +
                      (request.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")
                    }
                  >
                    {request.status}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {request.decided_at ? formatDate(request.decided_at) : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
