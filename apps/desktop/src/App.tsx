import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Wizard } from "./components/Wizard";
import { LogPanel } from "./components/LogPanel";

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Wizard currentStep={currentStep} onStepChange={setCurrentStep} addLog={addLog} />
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}
