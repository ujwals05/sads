-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "refreshTokenHash" DROP NOT NULL;
