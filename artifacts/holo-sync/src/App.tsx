import { useState } from "react";
import Landing from "./pages/Landing";
import InterviewConfig from "./pages/InterviewConfig";
import Interview from "./pages/Interview";
import IdeaTab from "./components/IdeaTab";
import type { Domain } from "./data/questions";
import type { InterviewConfig as IConfig } from "./data/questions";

type AppState = "landing" | "config" | "interview" | "idea";

function App() {
  const [state, setState] = useState<AppState>("landing");
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [interviewConfig, setInterviewConfig] = useState<IConfig | null>(null);

  const handleSelectDomain = (domain: Domain) => {
    setSelectedDomain(domain);
    setState("config");
  };

  const handleStartInterview = (config: IConfig) => {
    setInterviewConfig(config);
    setState("interview");
  };

  const handleBack = () => {
    setState("landing");
    setSelectedDomain(null);
    setInterviewConfig(null);
  };

  const handleEnd = () => {
    setState("landing");
    setSelectedDomain(null);
    setInterviewConfig(null);
  };

  const handleOpenIdea = () => {
    setState("idea");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {state === "landing" && <Landing onStart={handleSelectDomain} onOpenIdea={handleOpenIdea} />}
      {state === "config" && selectedDomain && (
        <InterviewConfig domain={selectedDomain} onStart={handleStartInterview} onBack={handleBack} />
      )}
      {state === "interview" && selectedDomain && interviewConfig && (
        <Interview domain={selectedDomain} config={interviewConfig} onEnd={handleEnd} />
      )}
      {state === "idea" && <IdeaTab onBack={handleBack} />}
    </div>
  );
}

export default App;
