import { z } from 'zod'

export const createSkinSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  weaponCategory: z.enum(['RIFLES', 'PRECISION', 'SIDEARMS', 'COMPACT', 'HEAVY', 'BLADES']),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'SPECIAL']),
  baseReferenceValue: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
})

export const createCaseSchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  casePrice: z.number().int().positive(),
  keyPrice: z.number().int().positive().optional(),
})

export const publishVersionSchema = z.object({
  drops: z
    .array(z.object({ skinDefinitionId: z.string().min(1), weight: z.number().int().nonnegative() }))
    .min(1),
})

export const setCaseStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']),
})

export const suspendUserSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().min(10).max(500),
})
