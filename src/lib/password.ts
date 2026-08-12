// Shared between the client-side live checklist (request-access-form.tsx)
// and the server-side re-validation (never trust client-only checks for
// something that creates a real account) - one source of truth for what
// "strong enough" means. Copy leans into the cat theme per the product's
// voice, same as the rest of the app.
export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 10 characters — give it some tail length",
    test: (p) => p.length >= 10,
  },
  {
    id: "uppercase",
    label: "One uppercase letter — puff up big",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "One lowercase letter — then settle back down",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "One number — for at least one of the nine lives",
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: "symbol",
    label: "One special character — sharpen those claws (!@#$...)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
