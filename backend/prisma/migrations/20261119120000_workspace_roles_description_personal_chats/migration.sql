-- Workspace & member management + workspace-scoped chat sessions.
--
-- 1. Collapse workspace roles to OWNER / ADMIN / MEMBER without losing data:
--    DEVELOPER is renamed to MEMBER, and VIEWER rows are folded into MEMBER.
-- 2. Workspaces get an optional description; rootPath becomes optional so a
--    workspace can exist independently of a local folder.
-- 3. Conversation.workspaceId becomes nullable: NULL = personal conversation.

-- 1. Roles ----------------------------------------------------------------
ALTER TYPE "WorkspaceRole" RENAME VALUE 'DEVELOPER' TO 'MEMBER';

UPDATE "WorkspaceMember" SET "role" = 'MEMBER' WHERE "role" = 'VIEWER';

CREATE TYPE "WorkspaceRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "WorkspaceMember"
  ALTER COLUMN "role" TYPE "WorkspaceRole_new"
  USING ("role"::text::"WorkspaceRole_new");

DROP TYPE "WorkspaceRole";

ALTER TYPE "WorkspaceRole_new" RENAME TO "WorkspaceRole";

ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- 2. Workspace fields -------------------------------------------------------
ALTER TABLE "Workspace" ADD COLUMN "description" TEXT;

ALTER TABLE "Workspace" ALTER COLUMN "rootPath" DROP NOT NULL;

-- 3. Personal conversations ---------------------------------------------------
ALTER TABLE "Conversation" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- Indexes -------------------------------------------------------------------
CREATE INDEX "WorkspaceMember_workspaceId_role_idx"
  ON "WorkspaceMember"("workspaceId", "role");

CREATE INDEX "Conversation_createdById_workspaceId_updatedAt_idx"
  ON "Conversation"("createdById", "workspaceId", "updatedAt");
