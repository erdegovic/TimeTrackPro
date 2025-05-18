import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client, Project, TimeEntry } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatTime } from "@/lib/utils/timeUtils";
import { format } from "date-fns";
import SimpleTimer from "./SimpleTimer";

export default function TimeTrackerForm() {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  
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

  // Handle client selection
  const handleClientChange = (value: string) => {
    const clientId = Number(value);
    setSelectedClientId(clientId);
    setSelectedProjectId(null); // Reset project when client changes
  };

  return (
    <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-4">
      <div className="max-w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 w-full">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Keyboard className="h-4 w-4 opacity-70" />
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
                    // Show an alert for now
                    window.alert("Add new client feature will be implemented soon");
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
                    // Show an alert for now
                    window.alert("Add new project feature will be implemented soon");
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
                  
                  // Prepare time entry data
                  const timeEntry = {
                    description,
                    projectId: selectedProjectId || 0,
                    // Pass the Date objects directly - they'll be serialized to strings automatically
                    startTime: startDateTime,
                    endTime: endDateTime,
                    // Format duration as a string (the server expects a string for numeric fields)
                    duration: (data.seconds / 3600).toFixed(2),
                    date: dateStr,
                    month: monthStr,
                    year: yearNum,
                    weekNumber: weekNum,
                    weekLabel: weekLabel,
                    billable: true,
                  };
                  
                  console.log("Saving time entry:", timeEntry);
                  
                  try {
                    // Save time entry
                    const result = await apiRequest("POST", "/api/time-entries", timeEntry);
                    console.log("Time entry saved:", result);
                    
                    // Show success toast
                    toast({
                      title: "Time entry saved",
                      description: "Your time entry has been saved successfully.",
                    });
                    
                    // Reset form
                    setDescription("");
                  } catch (error) {
                    console.error("Error saving time entry:", error);
                    toast({
                      title: "Error",
                      description: "Failed to save time entry. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}