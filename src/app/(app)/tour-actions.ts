"use server";

import { createClient } from "@/lib/supabase/server";

// Persisted on the analyst's own account row (see Step 17 in schema.sql)
// rather than localStorage - a per-browser flag reappears every time an
// analyst opens a new browser, an incognito window, or a different device,
// which reads as "the tour keeps starting randomly" even though it's just
// localStorage behaving exactly as localStorage always does. This follows
// the account instead, so it genuinely only ever shows once per analyst.
export async function markTourCompleted() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("users")
    .update({ tour_completed: true })
    .eq("id", user.id);
}
