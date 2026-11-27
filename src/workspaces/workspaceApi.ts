import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface Workspace {
  id: string;
  name: string;
  folder: string;
  createdAt: number;
  lastOpenedAt: number | null;
  folderExists: boolean;
}

export function listWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>("list_workspaces");
}

export function createWorkspace(id: string, folder: string, name: string): Promise<Workspace> {
  return invoke<Workspace>("create_workspace", { id, folder, name });
}

export function renameWorkspace(id: string, name: string): Promise<void> {
  return invoke("rename_workspace", { id, name });
}

export function markOpened(id: string): Promise<void> {
  return invoke("mark_opened", { id });
}

export function deleteWorkspace(id: string): Promise<void> {
  return invoke("delete_workspace", { id });
}

// Annuler le dialogue renvoie null. Une erreur du dialogue remonte à l'appelant.
export async function pickWorkspaceFolder(): Promise<string | null> {
  const folder = await open({ directory: true, multiple: false });
  return typeof folder === "string" ? folder : null;
}
