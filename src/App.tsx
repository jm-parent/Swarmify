import { useEffect } from "react";
import { Board } from "./canvas/Board";
import { restoreAndAutosave } from "./canvas/persistence";
import "./App.css";

function App() {
  useEffect(() => {
    void restoreAndAutosave();
  }, []);

  return (
    <div className="app">
      <Board />
    </div>
  );
}

export default App;
