import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyboard, Play, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client, Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { formatTime } from "@/lib/utils/timeUtils";

export default function TimeTrackerForm() {
  const { toast } = useToast();
  const { 
    isTracking, 
    description, 
    setDescription,
    elapsedTime,
    startTimer, 
    stopTimer,
    selectedClientId,
    setSelectedClientId,
    selectedProjectId,
    setSelectedProjectId
  } = useTimeTracker();
  
  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`/api/projects?clientId=${selectedClientId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  // Filtered projects for the selected client
  const clientProjects = selectedClientId 
    ? projects.filter(project => project.clientId === selectedClientId)
    : [];

  // Handle client selection
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(Number(clientId));
    setSelectedProjectId(undefined);
  };

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="p-5">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <div className="relative">
              <Input
                type="text"
                placeholder="What are you working on?"
                className="block w-full pr-10 text-base"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <Keyboard className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5 md:flex-nowrap w-full md:w-auto">
            <Select 
              value={selectedClientId?.toString()} 
              onValueChange={handleClientChange}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedProjectId?.toString()} 
              onValueChange={(val) => {
                if (val !== "new") {
                  setSelectedProjectId(Number(val));
                }
              }}
              disabled={!selectedClientId}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {clientProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="w-full md:w-auto min-w-[140px]">
              <Input
                type="text"
                value={formatTime(elapsedTime, "time")}
                className="block w-full text-center font-mono font-medium"
                readOnly
              />
            </div>
            
            <Button 
              variant={isTracking ? "destructive" : "default"}
              className={isTracking ? "bg-destructive" : "bg-accent"}
              onClick={isTracking ? stopTimer : startTimer}
              disabled={!description || !selectedProjectId}
            >
              {isTracking ? (
                <>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Start
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
