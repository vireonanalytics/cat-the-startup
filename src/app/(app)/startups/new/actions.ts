"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { createClient as createClientType } from "@/lib/supabase/server";

async function resolveTeamId(
  supabase: Awaited<ReturnType<typeof createClientType>>,
  userId: string
): Promise<{ teamId: string } | { error: string }> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: "Could not resolve your team. Contact an admin." };
  }

  return { teamId: profile.team_id };
}

export async function createStartup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(`/startups/new?error=${encodeURIComponent("Name is required.")}`);
  }

  const domain = String(formData.get("domain") ?? "").trim() || null;
  const sector = String(formData.get("sector") ?? "").trim() || null;
  const stage = String(formData.get("stage") ?? "").trim() || null;
  const askRaw = String(formData.get("ask_amount") ?? "").trim();
  const ask_amount = askRaw ? Number(askRaw) : null;
  const founder_names = String(formData.get("founder_names") ?? "").trim() || null;

  const team = await resolveTeamId(supabase, user.id);
  if ("error" in team) {
    redirect(`/startups/new?error=${encodeURIComponent(team.error)}`);
  }

  const { data: startup, error } = await supabase
    .from("startups")
    .insert({
      team_id: team.teamId,
      name,
      domain,
      sector,
      stage,
      ask_amount,
      founder_names,
      status: "new",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !startup) {
    redirect(
      `/startups/new?error=${encodeURIComponent(error?.message ?? "Failed to create startup.")}`
    );
  }

  redirect("/dashboard");
}

// Used by CreateFromDeckForm: creates a minimal startup row with a
// placeholder name (the real name and other basic-info fields are filled in
// moments later, once the deck has been uploaded and read - see
// processNewDeckAndExtractStartupInfo). Returns the id instead of
// redirecting so the client can continue the upload flow.
export async function createDraftStartupForDeck(
  placeholderName: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const team = await resolveTeamId(supabase, user.id);
  if ("error" in team) {
    return { error: team.error };
  }

  const { data: startup, error } = await supabase
    .from("startups")
    .insert({
      team_id: team.teamId,
      name: placeholderName || "Untitled startup",
      status: "new",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !startup) {
    return { error: error?.message ?? "Failed to create startup." };
  }

  return { id: startup.id };
}
