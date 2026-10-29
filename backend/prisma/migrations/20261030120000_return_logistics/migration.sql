-- AlterEnum (new return lifecycle stages)
ALTER TYPE "ReturnStatus" ADD VALUE 'PICKUP_BOOKED';
ALTER TYPE "ReturnStatus" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "ReturnStatus" ADD VALUE 'RECEIVED';

-- AlterTable (reverse pickup + inspection fields)
ALTER TABLE "return_requests"
  ADD COLUMN "pickupProvider" "CourierProvider",
  ADD COLUMN "pickupCourier" TEXT,
  ADD COLUMN "pickupAwb" TEXT,
  ADD COLUMN "pickupTrackingUrl" TEXT,
  ADD COLUMN "pickupStatus" "ShipmentStatus",
  ADD COLUMN "pickupBookedAt" TIMESTAMP(3),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "inspectedAt" TIMESTAMP(3),
  ADD COLUMN "inspectionPassed" BOOLEAN,
  ADD COLUMN "inspectionNote" TEXT;

-- CreateTable (return pickup timeline)
CREATE TABLE "return_tracking_events" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_tracking_events_returnId_idx" ON "return_tracking_events"("returnId");

-- AddForeignKey
ALTER TABLE "return_tracking_events" ADD CONSTRAINT "return_tracking_events_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
