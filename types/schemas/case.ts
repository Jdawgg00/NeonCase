import { z } from 'zod'

export const openCaseSchema = z.object({
  idempotencyKey: z.string().min(10).max(100),
})

export type OpenCaseInput = z.infer<typeof openCaseSchema>
