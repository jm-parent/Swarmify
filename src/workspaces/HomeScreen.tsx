import { errorMessage } from "../canvas/images";
import { pickWorkspaceFolder } from "./workspaceApi";
import { useWorkspaceStore } from "./workspaceStore";

export function HomeScreen() {
  const error = useWorkspaceStore((s) => s.error);

  const newWorkspace = async () => {
    useWorkspaceStore.setState({ error: null });
    try {
      const folder = await pickWorkspaceFolder();
      if (folder) await useWorkspaceStore.getState().create(folder);
    } catch (err) {
      useWorkspaceStore.setState({ error: errorMessage(err) });
    }
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
