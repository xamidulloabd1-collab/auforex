-- Merge the former ADMIN role into SUPER_ADMIN before the enum value is removed.
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'ADMIN';

-- CreateEnum
CREATE TYPE "ProRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- CreateTable
CREATE TABLE "ProRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProRequestStatus" NOT NULL DEFAULT 'PENDING',
    "price" INTEGER NOT NULL,
    "oldPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'so‘m',
    "channel" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(500),
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProRequest_status_createdAt_idx" ON "ProRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProRequest_userId_status_idx" ON "ProRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "ProRequest" ADD CONSTRAINT "ProRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProRequest" ADD CONSTRAINT "ProRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
