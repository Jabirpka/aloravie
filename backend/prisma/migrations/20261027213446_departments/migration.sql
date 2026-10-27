-- CreateEnum
CREATE TYPE "Department" AS ENUM ('RETURNS', 'PACKING', 'CUSTOMER_CARE', 'OFFERS', 'CRM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "departments" "Department"[] DEFAULT ARRAY[]::"Department"[];
