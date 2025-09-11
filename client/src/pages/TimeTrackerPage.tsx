// TimeTrackerPage.tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TimeTrackerForm from "@/components/TimeTracker/TimeTrackerForm";
import TimeEntryList from "@/components/TimeTracker/TimeEntryList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Client, Project } from "@shared/schema";
import ClientForm from "@/components/Clients/ClientForm";
import ProjectForm from "@/components/Projects/ProjectForm";
import { useTimerContext } from "@/context/TimerContext";

export default function TimeTrackerPage() {
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [selectedClientIdForProject, setSelectedClientIdForProject] = useState<number | undefined>(undefined);
  const [preDialogClientIds, setPreDialogClientIds] = useState<Set<number>>(new Set());
  const [preDialogProjectIds, setPreDialogProjectIds] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const { setSelectedClientId, setSelectedProjectId } = useTimerContext();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Monitor for new clients and projects being created
  useEffect(() => {
    // Find newly created clients
    const currentClientIds = new Set(clients.map(c => c.id));
    const newClients = clients.filter(client => !preDialogClientIds.has(client.id));
    
    if (newClients.length > 0 && preDialogClientIds.size > 0) {
      const newClient = newClients[0]; // Take the first new client
      console.log("🎯 New client detected via ID monitoring:", newClient);
      setSelectedClientId(newClient.id);
      toast({
        title: "Client auto-selected",
        description: `"${newClient.name}" is now selected in the time tracker.`,
        duration: 3000,
      });
    }
    
    // Find newly created projects
    const newProjects = projects.filter(project => !preDialogProjectIds.has(project.id));
    
    if (newProjects.length > 0 && preDialogProjectIds.size > 0) {
      const newProject = newProjects[0]; // Take the first new project
      console.log("🎯 New project detected via ID monitoring:", newProject);
      setSelectedProjectId(newProject.id);
      toast({
        title: "Project auto-selected", 
        description: `"${newProject.name}" is now selected in the time tracker.`,
        duration: 3000,
      });
    }
  }, [clients, projects, preDialogClientIds, preDialogProjectIds, setSelectedClientId, setSelectedProjectId, toast]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Time Tracker</h1>
        <div className="flex items-center space-x-2 flex-wrap">
          <Button onClick={() => {
            console.log("🎯 Capturing existing client IDs before opening dialog");
            setPreDialogClientIds(new Set(clients.map(c => c.id)));
            setShowNewClientDialog(true);
          }} variant="outline" size="sm" className="flex-shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Client
          </Button>
          <Button onClick={() => {
            console.log("🎯 Capturing existing project IDs before opening dialog");
            setPreDialogProjectIds(new Set(projects.map(p => p.id)));
            setShowNewProjectDialog(true);
          }} variant="outline" size="sm" className="flex-shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Project
          </Button>
        </div>
      </div>

      <TimeTrackerForm
        onAddClient={() => {
          console.log("🎯 Capturing existing client IDs from TimeTrackerForm");
          setPreDialogClientIds(new Set(clients.map(c => c.id)));
          setShowNewClientDialog(true);
        }}
        onAddProject={(clientId) => {
          console.log("🎯 Capturing existing project IDs from TimeTrackerForm");
          setPreDialogProjectIds(new Set(projects.map(p => p.id)));
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

          <ClientForm
            onSuccess={(createdClient) => {
              console.log("★ Client created in TimeTrackerPage:", createdClient);

              if (!createdClient) {
                console.warn("⚠️ onSuccess called with undefined client");
                return;
              }

              setShowNewClientDialog(false);

              if (createdClient.id) {
                console.log("★ Setting client ID directly:", createdClient.id);
                setSelectedClientId(createdClient.id);

                import("@/hooks/use-toast").then(({ toast }) => {
                  toast({
                    title: "Client auto-selected",
                    description: `"${createdClient.name}" is now selected in the time tracker.`,
                    duration: 3000,
                  });
                });
              }
            }}
            onCancel={() => {
              console.log("★ Cancel clicked");
              setShowNewClientDialog(false);
            }}
          />
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
              console.log("★ Project created in TimeTrackerPage:", createdProject);
              setShowNewProjectDialog(false);

              if (createdProject && createdProject.id) {
                console.log("★ Setting project ID directly:", createdProject.id);
                setSelectedProjectId(createdProject.id);

                import("@/hooks/use-toast").then(({ toast }) => {
                  toast({
                    title: "Project auto-selected",
                    description: `"${createdProject.name}" is now selected in the time tracker.`,
                    duration: 3000,
                  });
                });
              }
            }}
            initialData={{
              name: "",
              clientId: selectedClientIdForProject || "",
              description: "",
              active: true,
              hourlyRate: "0",
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}