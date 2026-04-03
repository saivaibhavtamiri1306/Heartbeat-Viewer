import { useState } from "react";
import Landing from "./pages/Landing";
import Interview from "./pages/Interview";
import type { Domain } from "./data/questions";

type AppState = "landing" | "interview";

function App() {
  const [state, setState] = useState<AppState>("landing");
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const handleStart = (domain: Domain) => {
    setSelectedDomain(domain);
    setState("interview");
  };

  const handleEnd = () => {
    setState("landing");
    setSelectedDomain(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {state === "landing" && <Landing onStart={handleStart} />}
      {state === "interview" && selectedDomain && (
        <Interview domain={selectedDomain} onEnd={handleEnd} />
      )}
    </div>
  );
}

export default App;
