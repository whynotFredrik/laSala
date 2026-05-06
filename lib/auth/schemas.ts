import { z } from "zod"

/**
 * Single source of truth for auth form validation. Used by react-hook-form on
 * the client and re-run server-side in the corresponding action — never
 * trust a client-only check.
 */

// Password rules at creation time: ≥8 chars, no whitespace anywhere. We're
// strict here because users on a phone with autocorrect routinely paste a
// trailing space and then can't log in. We don't apply this to sign-in (an
// existing password should still work even if it contains spaces).
const passwordCreate = z
  .string()
  .min(8, "password_too_short")
  .regex(/^\S+$/, "password_no_spaces")

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
export type SignInInput = z.infer<typeof signInSchema>

// Romanian phone numbers: optional +40 prefix, then 9 digits. We accept a
// loose form on input and normalise to +40XXXXXXXXX server-side.
const phoneRegex = /^(\+40|0040|0)?[0-9]{9}$/

export const signUpSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "phone_invalid"),
  password: passwordCreate,
  gdprConsent: z
    .boolean()
    .refine((v) => v === true, { message: "gdpr_required" }),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordCreate,
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "passwords_do_not_match",
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/**
 * Normalises a Romanian phone number into E.164 form (+40XXXXXXXXX).
 * Assumes the input has already passed `phoneRegex`.
 */
export function normalisePhone(input: string): string {
  const trimmed = input.replace(/\s+/g, "")
  if (trimmed.startsWith("+40")) return trimmed
  if (trimmed.startsWith("0040")) return `+${trimmed.slice(2)}`
  if (trimmed.startsWith("0")) return `+40${trimmed.slice(1)}`
  return `+40${trimmed}`
}
