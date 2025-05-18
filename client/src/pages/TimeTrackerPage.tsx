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

export default function TimeTrackerPage() {
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);

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
          setSelectedClientId(clientId);
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
          <ClientForm onSuccess={() => setShowNewClientDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm 
            onSuccess={() => setShowNewProjectDialog(false)} 
            initialData={{
              name: "",
              clientId: selectedClientId || "",
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
