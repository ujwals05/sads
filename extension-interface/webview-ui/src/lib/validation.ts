/** Client-side checks mirroring the backend workspace validation schema. */
export function validateWorkspaceFields(input: {
  name: string;
  description: string;
  rootPath: string;
}): { name?: string; description?: string; rootPath?: string } {
  const errs: { name?: string; description?: string; rootPath?: string } = {};
  const name = input.name.trim();

  if (!name) errs.name = 'Workspace name is required.';
  else if (name.length > 100) errs.name = 'Workspace name must not exceed 100 characters.';

  if (input.description.trim().length > 500) {
    errs.description = 'Description must not exceed 500 characters.';
  }

  const path = input.rootPath.trim();
  if (path.length > 1024) errs.rootPath = 'Project root path is too long.';
  else if (path.includes('\0')) errs.rootPath = 'Path contains invalid characters.';

  return errs;
}
