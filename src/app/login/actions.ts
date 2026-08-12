"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { isPasswordStrong } from "@/lib/password";
import { sendSignupRequestEmail } from "@/lib/email";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({
      error: error.message,
      redirectTo,
    });
    redirect(`/login?${params.toString()}`);
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// No account is created here - this just files a request. The password is
// encrypted at rest (see src/lib/crypto.ts) and only decrypted at approval
// time, when approveSignupRequest actually calls auth.signUp() with it.
export async function requestAccess(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  function fail(message: string): never {
    const params = new URLSearchParams({ error: message, name, email });
    redirect(`/request-access?${params.toString()}`);
  }

  if (!name) {
    fail("Enter your name.");
  }
  if (!email || !email.includes("@")) {
    fail("Enter a valid email address.");
  }
  if (password !== confirmPassword) {
    fail("Passwords don't match.");
  }
  if (!isPasswordStrong(password)) {
    fail("That password isn't strong enough yet - check the checklist below.");
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("signup_requests").insert({
    name,
    email,
    password_encrypted: encryptSecret(password),
  });

  if (insertError) {
    console.error("Failed to save signup request:", insertError.message);
    fail("Something went wrong submitting your request - try again.");
  }

  // Soft-fail: the request is already saved regardless of whether the
  // email actually goes out (see sendSignupRequestEmail).
  await sendSignupRequestEmail({ name, email });

  redirect("/request-access?submitted=1");
}
