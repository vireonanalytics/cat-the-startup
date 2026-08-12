"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import type { Database } from "@/lib/supabase/types";

async function requireAdmin() {
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

  return { supabase, adminId: user.id };
}

export async function approveSignupRequest(formData: FormData) {
  const requestId = String(formData.get("id") ?? "");
  if (!requestId) return;

  const { supabase, adminId } = await requireAdmin();

  const { data: request, error: fetchError } = await supabase
    .from("signup_requests")
    .select("id, name, email, password_encrypted, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    redirect(`/admin/requests?error=${encodeURIComponent("Request not found.")}`);
  }

  if (request.status !== "pending") {
    redirect(
      `/admin/requests?error=${encodeURIComponent("This request was already decided.")}`
    );
  }

  let password: string;
  try {
    password = decryptSecret(request.password_encrypted);
  } catch (err) {
    console.error("Failed to decrypt signup request password:", err);
    redirect(
      `/admin/requests?error=${encodeURIComponent("Could not read this request's password - it may be corrupted.")}`
    );
  }

  // A fresh, isolated client rather than the cookie-bound one from
  // createClient() above - calling auth.signUp() on the cookie-bound client
  // would overwrite the admin's own session cookies with the newly created
  // user's session, silently signing the admin out and into that account.
  // persistSession/autoRefreshToken: false means this client never touches
  // cookies or localStorage at all.
  const isolatedClient = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error: signUpError } = await isolatedClient.auth.signUp({
    email: request.email,
    password,
    options: { data: { name: request.name } },
  });

  if (signUpError) {
    redirect(`/admin/requests?error=${encodeURIComponent(signUpError.message)}`);
  }

  await supabase
    .from("signup_requests")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: adminId,
    })
    .eq("id", requestId);

  revalidatePath("/admin/requests");
  redirect("/admin/requests?approved=1");
}

export async function rejectSignupRequest(formData: FormData) {
  const requestId = String(formData.get("id") ?? "");
  if (!requestId) return;

  const { supabase, adminId } = await requireAdmin();

  await supabase
    .from("signup_requests")
    .update({
      status: "rejected",
      decided_at: new Date().toISOString(),
      decided_by: adminId,
    })
    .eq("id", requestId);

  revalidatePath("/admin/requests");
  redirect("/admin/requests?rejected=1");
}
