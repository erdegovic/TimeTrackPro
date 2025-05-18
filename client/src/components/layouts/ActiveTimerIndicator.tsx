import { useState, useEffect } from "react";
import { Timer, AlertCircle } from "lucide-react";
import { formatTime } from "../../lib/utils/timeUtils";

export default function ActiveTimerIndicator() {
  const [activeTimer, setActiveTimer] = useState<{ 
    startTime: number; 
    description: string;
    projectName?: string;
    clientName?: string;
    elapsedTime: number;
  } | null>(null);

  // Check for active timer every second
  useEffect(() => {
    const checkTimer = () => {
      const storedTimer = localStorage.getItem("timeTracker");
      if (storedTimer) {
        try {
          const { startTime, description, projectId, clientId } = JSON.parse(storedTimer);
          if (startTime) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            
            // Get project and client names if available
            const projectsData = localStorage.getItem("cachedProjects");
            const clientsData = localStorage.getItem("cachedClients");
            
            let projectName;
            let clientName;
            
            if (projectsData && projectId) {
              const projects = JSON.parse(projectsData);
              const project = projects.find((p: any) => p.id === projectId);
              projectName = project?.name;
            }
            
            if (clientsData && clientId) {
              const clients = JSON.parse(clientsData);
              const client = clients.find((c: any) => c.id === clientId);
              clientName = client?.name;
            }
            
            setActiveTimer({
              startTime,
              description,
              projectName,
              clientName,
              elapsedTime: elapsed
            });
          } else {
            setActiveTimer(null);
          }
        } catch (error) {
          console.error("Error parsing stored timer:", error);
          setActiveTimer(null);
        }
      } else {
        setActiveTimer(null);
      }
    };
    
    // Check immediately and then every second
    checkTimer();
    const intervalId = setInterval(checkTimer, 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  if (!activeTimer) return null;

  return (
    <div className="mx-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-center">
        <Timer className="w-5 h-5 mr-2 text-blue-600 animate-pulse" />
        <span className="text-sm font-medium text-blue-700">Timer Running</span>
      </div>
      <div className="mt-2">
        <div className="text-xs font-medium text-gray-500">
          {activeTimer.projectName || "Project"} 
          {activeTimer.clientName && ` - ${activeTimer.clientName}`}
        </div>
        <div className="text-sm font-medium mt-1 truncate text-gray-700">
          {activeTimer.description}
        </div>
        <div className="mt-1 font-mono text-sm text-blue-700">
          {formatTime(activeTimer.elapsedTime)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Safe to change tabs or close window
        </div>
      </div>
    </div>
  );
}