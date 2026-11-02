-- CreateTable
CREATE TABLE "staff_messages" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_messages_createdAt_idx" ON "staff_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
