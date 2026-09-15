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
