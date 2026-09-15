import { z } from 'zod'

export const createListingSchema = z.object({
  inventoryItemId: z.string().min(1),
  price: z.number().int('Pris må være et heltall').positive('Pris må være positiv'),
})

export const buyListingSchema = z.object({
  idempotencyKey: z.string().min(10).max(100),
})

export const inventoryFavoriteSchema = z.object({
  favorited: z.boolean(),
})

export const inventoryLockSchema = z.object({
  locked: z.boolean(),
})

export const quickSellSchema = z.object({
  idempotencyKey: z.string().min(10).max(100),
})
