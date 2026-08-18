import { Resend } from "resend";

const APPROVAL_INBOX = "vireonanalytics@gmail.com";

// Soft-fails by design: a signup request is already safely stored in the
// database by the time this is called (see requestAccess in
// login/actions.ts), so a missing API key or a Resend outage shouldn't
// block the request itself - it just means the admin has to notice the
// pending request in /admin/requests instead of getting pinged about it.
export async function sendSignupRequestEmail({
  name,
  email,
}: {
  name: string;
  email: string;
}): Promise<{ error: string } | { ok: true }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not set - skipping signup request email (the request itself was still saved)."
    );
    return { error: "RESEND_API_KEY is not configured." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const reviewUrl = `${siteUrl}/admin/requests`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "Cat the Startup <onboarding@resend.dev>",
      to: APPROVAL_INBOX,
      subject: `New access request: ${name}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
          <p style="font-size: 20px; margin-bottom: 4px;">🐾 Someone wants in.</p>
          <p style="color: #52525b; margin-top: 0;">A new access request just came in for Cat the Startup.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 6px 0; color: #71717a; width: 80px;">Name</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #71717a;">Email</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(email)}</td>
            </tr>
          </table>
          <a href="${reviewUrl}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 500;">
            Review the request
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
            No account has been created yet - nothing happens until you approve it from that page.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend failed to send signup request email:", error);
      return { error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Resend request failed:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send email.",
    };
  }
}

// Soft-fails for the same reason as sendSignupRequestEmail above - the
// account itself is already created by the time this runs (see
// approveSignupRequest in admin/requests/actions.ts), so a missing key or a
// Resend outage shouldn't undo the approval or block the admin's flow. The
// analyst just has to be told some other way (Slack, in person) that
// they're in, rather than never hearing anything past their original
// request - the account isn't blocked on this either way, they can already
// sign in.
export async function sendAccountCreatedEmail({
  name,
  email,
}: {
  name: string;
  email: string;
}): Promise<{ error: string } | { ok: true }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not set - skipping account-created email (the account itself was still created)."
    );
    return { error: "RESEND_API_KEY is not configured." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const loginUrl = `${siteUrl}/login`;

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "Cat the Startup <onboarding@resend.dev>",
      to: email,
      subject: "You're in - your Cat the Startup account is ready",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
          <p style="font-size: 20px; margin-bottom: 4px;">🐾 You're in, ${escapeHtml(name.split(" ")[0] || name)}!</p>
          <p style="color: #52525b; margin-top: 0;">
            Your Cat the Startup account has been approved and is ready to go - sign in with the email and password you requested access with.
          </p>
          <a href="${loginUrl}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 500; margin-top: 8px;">
            Sign in
          </a>
        </div>
      `,
    });

    if (error) {
      console.error("Resend failed to send account-created email:", error);
      return { error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Resend request failed:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to send email.",
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
