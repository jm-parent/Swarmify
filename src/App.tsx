import { useEffect } from "react";
import { Board } from "./canvas/Board";
import { BoardContext } from "./canvas/boardStore";
import { HomeScreen } from "./workspaces/HomeScreen";
import { WorkspaceSwitcher } from "./workspaces/WorkspaceSwitcher";
import { useWorkspaceStore } from "./workspaces/workspaceStore";
import "./App.css";

function App() {
  const loaded = useWorkspaceStore((s) => s.loaded);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const open = useWorkspaceStore((s) => s.open);

  useEffect(() => {
    void useWorkspaceStore.getState().load();
  }, []);

  if (!loaded) return null;
  if (workspaces.length === 0) return <HomeScreen />;

  return (
    <div className="app">
      <WorkspaceSwitcher />
      {Object.entries(open).map(([id, { store }]) => (
        <div key={id} className="workspace-view" style={{ display: id === activeId ? undefined : "none" }}>
          <BoardContext.Provider value={store}>
            <Board />
          </BoardContext.Provider>
        </div>
      ))}
    </div>
  );
}

export default App;
