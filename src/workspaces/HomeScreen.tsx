import { open } from "@tauri-apps/plugin-dialog";
import { errorMessage } from "../canvas/images";
import { useWorkspaceStore } from "./workspaceStore";

// Annuler le dialogue renvoie null. Une erreur du dialogue est publiée dans le store, comme les autres actions.
export async function pickWorkspaceFolder(): Promise<string | null> {
  try {
    const folder = await open({ directory: true, multiple: false });
    return typeof folder === "string" ? folder : null;
  } catch (err) {
    useWorkspaceStore.setState({ error: errorMessage(err) });
    return null;
  }
}

export function HomeScreen() {
  const error = useWorkspaceStore((s) => s.error);

  const newWorkspace = async () => {
    const folder = await pickWorkspaceFolder();
    if (folder) await useWorkspaceStore.getState().create(folder);
  };

  return (
    <div className="home-screen">
      <h1 className="home-title">Swarmify</h1>
      <button type="button" className="home-action" onClick={() => void newWorkspace()}>
        Choisir un dossier
      </button>
      {error && <p className="home-error" role="alert">{error}</p>}
    </div>
  );
}
