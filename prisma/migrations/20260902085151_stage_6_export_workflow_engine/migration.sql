-- CreateEnum
CREATE TYPE "ExportStuffingType" AS ENUM ('NONE', 'DOCK', 'FACTORY');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "exportStuffingType" "ExportStuffingType";

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSkippable" BOOLEAN NOT NULL DEFAULT false;
