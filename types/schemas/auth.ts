import { z } from 'zod'

/**
 * The display name *is* the account identity here — typing it again is what
 * signs you back in — and it also appears in profile URLs (/u/:username),
 * so it's kept URL-safe: letters (including æøå), digits, and . _ - only.
 * No spaces, which also keeps the derived identity e-mail collision-free.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Navnet må være minst 2 tegn')
  .max(24, 'Navnet kan være maks 24 tegn')
  .regex(
    /^[\p{L}\p{N}._-]+$/u,
    'Bruk bokstaver, tall, punktum, bindestrek eller understrek — ingen mellomrom',
  )

export type DisplayName = z.infer<typeof displayNameSchema>

/**
 * bcrypt silently truncates input over 72 bytes, so cap length here to fail
 * loudly instead. No complexity rules — this protects a virtual, no-real-
 * value account, not a real one; the goal is "not blank", not NIST 800-63.
 */
export const passwordSchema = z
  .string()
  .min(4, 'Passordet må være minst 4 tegn')
  .max(72, 'Passordet kan være maks 72 tegn')

export type Password = z.infer<typeof passwordSchema>
