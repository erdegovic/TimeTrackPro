import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client, Project, TimeEntry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatTime } from "@/lib/utils/timeUtils";
import { format } from "date-fns";
import SimpleTimer from "./SimpleTimer";

interface TimeTrackerFormProps {
  onAddClient?: () => void;
  onAddProject?: (clientId: number) => void;
}

export default function TimeTrackerForm({ onAddClient, onAddProject }: TimeTrackerFormProps = {}) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  // On component mount, check if there's an active timer and initialize form state
  useEffect(() => {
    try {
      const storedTimer = localStorage.getItem("timeTracker");
      if (storedTimer) {
        const parsedTimer = JSON.parse(storedTimer);
        const { description: storedDesc, projectId, clientId } = parsedTimer;
        
        // Populate the form with the stored values
        if (storedDesc) setDescription(storedDesc);
        if (projectId) setSelectedProjectId(projectId);
        if (clientId) setSelectedClientId(clientId);
        
        // Set timer active state so UI can be updated
        setIsTimerActive(true);
        
        // Make the clientId available for the timer
        if (typeof window !== 'undefined') {
          // @ts-ignore - add selectedClientId to window for SimpleTimer to use
          window.selectedClientId = clientId;
        }
      }
    } catch (error) {
      console.error("Error restoring timer state:", error);
    }
  }, []);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json() as Promise<Client[]>;
    }
  });

  // Fetch projects for the selected client
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/projects?clientId=${selectedClientId}`);
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json() as Promise<Project[]>;
    },
    enabled: !!selectedClientId
  });

  // Listen for play button events from time entries
  useEffect(() => {
    const handleStartTimerFromEntry = (event: CustomEvent) => {
      const { description: entryDescription, projectId, clientId } = event.detail;
      
      // Update form fields
      setDescription(entryDescription);
      setSelectedProjectId(projectId);
      setSelectedClientId(clientId || null);
      
      // Start the timer automatically
      setTimeout(() => {
        // Trigger timer start by simulating click on start button
        const startButton = document.querySelector('[data-timer-start]') as HTMLButtonElement;
        if (startButton && !startButton.disabled) {
          startButton.click();
        }
      }, 100); // Small delay to ensure form state is updated
    };

    // Listen for both old and new event names
    window.addEventListener('startTimerFromEntry', handleStartTimerFromEntry as EventListener);
    window.addEventListener('startTimerWithMerging', handleStartTimerFromEntry as EventListener);
    
    return () => {
      window.removeEventListener('startTimerFromEntry', handleStartTimerFromEntry as EventListener);
      window.removeEventListener('startTimerWithMerging', handleStartTimerFromEntry as EventListener);
    };
  }, [projects]);

  // Handle client selection
  const handleClientChange = (value: string) => {
    const clientId = Number(value);
    setSelectedClientId(clientId);
    setSelectedProjectId(null); // Reset project when client changes
  };

  return (
    <div className="tickd-card-elevated tickd-spacing-lg">
      <div className="max-w-full">
        <div className="flex flex-col gap-4">
          {/* Layout 1: Large screens - Everything in one row */}
          <div className="hidden xl:flex xl:items-center gap-2.5 w-full">
            <div className="flex-1 mb-2 md:mb-0">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-70"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h.001"></path><path d="M10 8h.001"></path><path d="M14 8h.001"></path><path d="M18 8h.001"></path><path d="M8 12h.001"></path><path d="M12 12h.001"></path><path d="M16 12h.001"></path><path d="M7 16h10"></path></svg>
                </span>
                <Input
                  type="text"
                  placeholder="What are you working on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2.5 md:flex-nowrap w-full md:w-auto">
              <Select 
                value={selectedClientId?.toString()} 
                onValueChange={(value) => {
                  console.log("Client selected:", value);
                  if (value === "new") {
                    if (onAddClient) {
                      onAddClient();
                    }
                  } else {
                    handleClientChange(value);
                  }
                }}
              >
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ Add new client</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedProjectId?.toString()} 
                onValueChange={(val) => {
                  console.log("Project selected:", val);
                  if (val === "new") {
                    if (onAddProject && selectedClientId) {
                      onAddProject(selectedClientId);
                    }
                  } else {
                    setSelectedProjectId(Number(val));
                  }
                }}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ Add new project</SelectItem>
                </SelectContent>
              </Select>
              
              <SimpleTimer 
                description={description}
                projectId={selectedProjectId || undefined}
                clientId={selectedClientId || undefined}
                isDisabled={!description || !selectedProjectId}
                onStop={async (data) => {
                  console.log("Timer stopped with data:", data);
                  
                  // Format dates for display
                  const dateStr = format(data.startTime, 'yyyy-MM-dd');
                  const monthStr = format(data.startTime, 'MMMM');
                  const yearNum = data.startTime.getFullYear();
                  
                  // Calculate week number and label
                  const weekNum = Math.ceil(data.startTime.getDate() / 7);
                  const weekLabel = `Week ${weekNum}`;
                  
                  // Format date values according to what the server expects
                  const startDateTime = new Date(data.startTime);
                  const endDateTime = new Date(data.endTime);
                  
                  // Calculate duration correctly
                  const diffMs = endDateTime.getTime() - startDateTime.getTime();
                  
                  // Calculate exact duration with higher precision (no minimum value)
                  const hoursDecimal = diffMs / (1000 * 60 * 60);
                  
                  // Convert to string with 4 decimal places to capture seconds precisely
                  const diffHours = hoursDecimal.toFixed(4);
                  
                  console.log(`Client calculated exact duration: ${diffHours} hours from ${diffMs}ms (${hoursDecimal} raw hours)`);
                  
                  // Prepare time entry data
                  const timeEntry = {
                    description,
                    projectId: selectedProjectId || 0,
                    // Pass the Date objects directly - they'll be serialized to strings automatically
                    startTime: startDateTime,
                    endTime: endDateTime,
                    // Use the properly calculated duration (as a string to preserve decimal precision)
                    duration: diffHours,
                    date: dateStr,
                    month: monthStr,
                    year: yearNum,
                    weekNumber: weekNum,
                    weekLabel: weekLabel,
                    billable: true,
                  };
                  
                  console.log("Saving time entry:", timeEntry);
                  
                  // BYPASS OLD SAVE LOGIC - SimpleTimer now handles everything
                  // This prevents the duplicate creation issue
                  console.log("Timer data received but bypassed - SimpleTimer handles save logic");
                  
                  // Just invalidate cache to refresh UI
                  queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
                  
                  // Reset form
                  setDescription("");
                }}
              />
            </div>
          </div>

          {/* Layout 2: Medium screens - Two rows */}
          <div className="hidden md:block xl:hidden">
            <div className="flex flex-col gap-4">
              <div className="w-full">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-70"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h.001"></path><path d="M10 8h.001"></path><path d="M14 8h.001"></path><path d="M18 8h.001"></path><path d="M8 12h.001"></path><path d="M12 12h.001"></path><path d="M16 12h.001"></path><path d="M7 16h10"></path></svg>
                  </span>
                  <Input
                    type="text"
                    placeholder="What are you working on?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <Select 
                  value={selectedClientId?.toString()} 
                  onValueChange={(value) => {
                    console.log("Client selected:", value);
                    if (value === "new") {
                      if (onAddClient) {
                        onAddClient();
                      }
                    } else {
                      handleClientChange(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                    ))}
                    <SelectItem value="new">+ Add new client</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={selectedProjectId?.toString()} 
                  onValueChange={(val) => {
                    console.log("Project selected:", val);
                    if (val === "new") {
                      if (onAddProject && selectedClientId) {
                        onAddProject(selectedClientId);
                      }
                    } else {
                      setSelectedProjectId(Number(val));
                    }
                  }}
                  disabled={!selectedClientId}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>
                    ))}
                    <SelectItem value="new">+ Add new project</SelectItem>
                  </SelectContent>
                </Select>
                
                <SimpleTimer 
                  description={description}
                  projectId={selectedProjectId || undefined}
                  clientId={selectedClientId || undefined}
                  isDisabled={!description || !selectedProjectId}
                  onStop={async (data) => {
                    console.log("Timer stopped with data:", data);
                    
                    // Format dates for display
                    const dateStr = format(data.startTime, 'yyyy-MM-dd');
                    const monthStr = format(data.startTime, 'MMMM');
                    const yearNum = data.startTime.getFullYear();
                    
                    // Calculate week number and label
                    const weekNum = Math.ceil(data.startTime.getDate() / 7);
                    const weekLabel = `Week ${weekNum}`;
                    
                    // Format date values according to what the server expects
                    const startDateTime = new Date(data.startTime);
                    const endDateTime = new Date(data.endTime);
                    
                    // Calculate duration correctly
                    const diffMs = endDateTime.getTime() - startDateTime.getTime();
                    
                    // Calculate exact duration with higher precision (no minimum value)
                    const hoursDecimal = diffMs / (1000 * 60 * 60);
                    
                    // Convert to string with 4 decimal places to capture seconds precisely
                    const diffHours = hoursDecimal.toFixed(4);
                    
                    console.log(`Client calculated exact duration: ${diffHours} hours from ${diffMs}ms (${hoursDecimal} raw hours)`);
                    
                    // Prepare time entry data
                    const timeEntry = {
                      description,
                      projectId: selectedProjectId || 0,
                      // Pass the Date objects directly - they'll be serialized to strings automatically
                      startTime: startDateTime,
                      endTime: endDateTime,
                      // Use the properly calculated duration (as a string to preserve decimal precision)
                      duration: diffHours,
                      date: dateStr,
                      month: monthStr,
                      year: yearNum,
                      weekNumber: weekNum,
                      weekLabel: weekLabel,
                      billable: true,
                    };
                    
                    console.log("Saving time entry:", timeEntry);
                    
                    // BYPASS OLD SAVE LOGIC - SimpleTimer now handles everything
                    // This prevents the duplicate creation issue
                    console.log("Timer data received but bypassed - SimpleTimer handles save logic");
                    
                    // Just invalidate cache to refresh UI
                    queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
                    
                    // Reset form
                    setDescription("");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Layout 3: Small screens - Three rows */}
          <div className="md:hidden flex flex-col gap-4">
            <div className="w-full">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-70"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h.001"></path><path d="M10 8h.001"></path><path d="M14 8h.001"></path><path d="M18 8h.001"></path><path d="M8 12h.001"></path><path d="M12 12h.001"></path><path d="M16 12h.001"></path><path d="M7 16h10"></path></svg>
                </span>
                <Input
                  type="text"
                  placeholder="What are you working on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Select 
                value={selectedClientId?.toString()} 
                onValueChange={(value) => {
                  console.log("Client selected:", value);
                  if (value === "new") {
                    if (onAddClient) {
                      onAddClient();
                    }
                  } else {
                    handleClientChange(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ Add new client</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedProjectId?.toString()} 
                onValueChange={(val) => {
                  console.log("Project selected:", val);
                  if (val === "new") {
                    if (onAddProject && selectedClientId) {
                      onAddProject(selectedClientId);
                    }
                  } else {
                    setSelectedProjectId(Number(val));
                  }
                }}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ Add new project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full">
              <SimpleTimer 
                description={description}
                projectId={selectedProjectId || undefined}
                clientId={selectedClientId || undefined}
                isDisabled={!description || !selectedProjectId}
                onStop={async (data) => {
                  console.log("Timer stopped with data:", data);
                  
                  // Format dates for display
                  const dateStr = format(data.startTime, 'yyyy-MM-dd');
                  const monthStr = format(data.startTime, 'MMMM');
                  const yearNum = data.startTime.getFullYear();
                  
                  // Calculate week number and label
                  const weekNum = Math.ceil(data.startTime.getDate() / 7);
                  const weekLabel = `Week ${weekNum}`;
                  
                  // Format date values according to what the server expects
                  const startDateTime = new Date(data.startTime);
                  const endDateTime = new Date(data.endTime);
                  
                  // Calculate duration correctly
                  const diffMs = endDateTime.getTime() - startDateTime.getTime();
                  
                  // Calculate exact duration with higher precision (no minimum value)
                  const hoursDecimal = diffMs / (1000 * 60 * 60);
                  
                  // Convert to string with 4 decimal places to capture seconds precisely
                  const diffHours = hoursDecimal.toFixed(4);
                  
                  console.log(`Client calculated exact duration: ${diffHours} hours from ${diffMs}ms (${hoursDecimal} raw hours)`);
                  
                  // Prepare time entry data
                  const timeEntry = {
                    description,
                    projectId: selectedProjectId || 0,
                    // Pass the Date objects directly - they'll be serialized to strings automatically
                    startTime: startDateTime,
                    endTime: endDateTime,
                    // Use the properly calculated duration (as a string to preserve decimal precision)
                    duration: diffHours,
                    date: dateStr,
                    month: monthStr,
                    year: yearNum,
                    weekNumber: weekNum,
                    weekLabel: weekLabel,
                    billable: true,
                  };
                  
                  console.log("Saving time entry:", timeEntry);
                  
                  // BYPASS OLD SAVE LOGIC - SimpleTimer now handles everything
                  // This prevents the duplicate creation issue
                  console.log("Timer data received but bypassed - SimpleTimer handles save logic");
                  
                  // Just invalidate cache to refresh UI
                  queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
                  
                  // Reset form
                  setDescription("");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}