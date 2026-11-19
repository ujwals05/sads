-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "blocks" JSONB,
ADD COLUMN     "sequence" SERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "Message_conversationId_sequence_idx" ON "Message"("conversationId", "sequence");
