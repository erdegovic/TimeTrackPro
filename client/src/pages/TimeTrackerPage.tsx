import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TimeTrackerForm from "@/components/TimeTracker/TimeTrackerForm";
import TimeEntryList from "@/components/TimeTracker/TimeEntryList";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Client, Project } from "@shared/schema";
import ClientForm from "@/components/Clients/ClientForm";
import ProjectForm from "@/components/Projects/ProjectForm";
import { useTimerContext } from "@/context/TimerContext";

export default function TimeTrackerPage() {
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [selectedClientIdForProject, setSelectedClientIdForProject] = useState<number | undefined>(undefined);
  
  // Use timer context to manage selected client and project
  const { setSelectedClientId, setSelectedProjectId } = useTimerContext();

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Time Tracker</h1>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowNewClientDialog(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" /> Client
          </Button>
          <Button
            onClick={() => setShowNewProjectDialog(true)}
            variant="outline"
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" /> Project
          </Button>
        </div>
      </div>

      <TimeTrackerForm 
        onAddClient={() => setShowNewClientDialog(true)}
        onAddProject={(clientId) => {
          setSelectedClientIdForProject(clientId);
          setShowNewProjectDialog(true);
        }}
      />
      <TimeEntryList />

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm onSuccess={(createdClient) => {
            console.log("Client created:", createdClient);
            setShowNewClientDialog(false);
            if (createdClient && createdClient.id) {
              // Wait a bit for query invalidation, then select the client
              setTimeout(() => {
                console.log("Auto-selecting client ID:", createdClient.id);
                setSelectedClientId(createdClient.id);
                // Show a toast to confirm selection
                import("@/hooks/use-toast").then(({ toast }) => {
                  toast({
                    title: "Client auto-selected",
                    description: `"${createdClient.name}" is now selected in the time tracker.`,
                    duration: 3000,
                  });
                });
              }, 100);
            }
          }} />
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm 
            onSuccess={(createdProject) => {
              console.log("Project created:", createdProject);
              setShowNewProjectDialog(false);
              if (createdProject && createdProject.id) {
                // Wait a bit for query invalidation, then select the project
                setTimeout(() => {
                  console.log("Auto-selecting project ID:", createdProject.id);
                  setSelectedProjectId(createdProject.id);
                  // Show a toast to confirm selection
                  import("@/hooks/use-toast").then(({ toast }) => {
                    toast({
                      title: "Project auto-selected",
                      description: `"${createdProject.name}" is now selected in the time tracker.`,
                      duration: 3000,
                    });
                  });
                }, 100);
              }
            }} 
            initialData={{
              name: "",
              clientId: selectedClientIdForProject || "",
              description: "",
              active: true,
              hourlyRate: "0"
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
