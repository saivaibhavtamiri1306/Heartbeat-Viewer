import { useState } from "react";
import Landing from "./pages/Landing";
import InterviewConfig from "./pages/InterviewConfig";
import Interview from "./pages/Interview";
import type { Domain } from "./data/questions";
import type { InterviewConfig as IConfig } from "./data/questions";

type AppState = "landing" | "interview";

function App() {
  const [state, setState] = useState<AppState>("landing");
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [interviewConfig, setInterviewConfig] = useState<IConfig | null>(null);

  const handleSelectDomain = (domain: Domain) => {
    setSelectedDomain(domain);
    setShowConfigModal(true);
  };

  const handleStartInterview = (config: IConfig) => {
    setInterviewConfig(config);
    setShowConfigModal(false);
    setState("interview");
  };

  const handleCloseModal = () => {
    setShowConfigModal(false);
    setSelectedDomain(null);
  };

  const handleEnd = () => {
    setState("landing");
    setSelectedDomain(null);
    setInterviewConfig(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {state === "landing" && (
        <>
          <Landing onStart={handleSelectDomain} />
          {showConfigModal && selectedDomain && (
            <InterviewConfig
              domain={selectedDomain}
              onStart={handleStartInterview}
              onBack={handleCloseModal}
            />
          )}
        </>
      )}
      {state === "interview" && selectedDomain && interviewConfig && (
        <Interview domain={selectedDomain} config={interviewConfig} onEnd={handleEnd} />
      )}
    </div>
  );
}

export default App;
