import { z } from 'zod'

export const adminWalletAdjustmentSchema = z.object({
  targetUserId: z.string().min(1),
  amount: z
    .number()
    .int('Beløp må være et heltall')
    .refine((v) => v !== 0, 'Beløp kan ikke være null'),
  reason: z.string().min(10, 'Begrunnelse må være minst 10 tegn').max(500),
  // Client-supplied so a double-click / retried request is provably the
  // same intended action, not a second one.
  idempotencyKey: z.string().min(10).max(100),
})

export type AdminWalletAdjustmentInput = z.infer<typeof adminWalletAdjustmentSchema>
