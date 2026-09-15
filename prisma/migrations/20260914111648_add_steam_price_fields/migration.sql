-- AlterTable
ALTER TABLE "SkinDefinition" ADD COLUMN     "steamPriceCents" INTEGER,
ADD COLUMN     "steamPriceCurrency" TEXT DEFAULT 'NOK',
ADD COLUMN     "steamPriceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "steamVolume" INTEGER;
