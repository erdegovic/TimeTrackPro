import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import ProjectForm from "@/components/Projects/ProjectForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Project, Client } from "@shared/schema";
import { formatCurrency } from "../lib/utils/timeUtils";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  
  // Fetch projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  
  // Fetch clients for project data
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Delete project mutation
  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully.",
      });
      setSelectedProjectId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the project. Make sure no time entries are associated with this project.",
        variant: "destructive",
      });
    }
  });
  
  const handleEditProject = (project: Project) => {
    setEditingProject(project);
  };
  
  const handleEditComplete = () => {
    setEditingProject(null);
  };
  
  const columns = [
    {
      header: "Name",
      accessorKey: "name",
      className: "font-medium",
    },
    {
      header: "Client",
      accessorKey: (row: Project) => {
        const client = clients.find(c => c.id === row.clientId);
        return client ? client.name : "Unknown Client";
      },
    },
    {
      header: "Status",
      accessorKey: (row: Project) => (
        <Badge variant={row.active ? "success" : "secondary"}>
          {row.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Hourly Rate",
      accessorKey: (row: Project) => {
        // Find the client to get their currency
        const client = clients.find(c => c.id === row.clientId);
        const currency = client?.currency || 'USD';
        
        // Format the hourly rate with the client's currency
        return formatCurrency(Number(row.hourlyRate), currency);
      },
    },
    {
      header: "Description",
      accessorKey: (row: Project) => (
        <div className="max-w-[200px] truncate" title={row.description || ""}>
          {row.description || "—"}
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: (row: Project) => (
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleEditProject(row)}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedProjectId(row.id)}
            className="h-8 w-8 text-destructive hover:text-destructive/80"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
        <Button onClick={() => setShowNewProjectDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project List</CardTitle>
          <CardDescription>
            Manage your projects and their rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={projects}
            columns={columns}
            isLoading={isLoading}
            emptyState={
              <div className="text-center py-8 text-gray-500">
                <Folder className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No projects</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You haven't added any projects yet. Add a project to get started.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowNewProjectDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Project
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm onSuccess={() => setShowNewProjectDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editingProject !== null} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm 
              onSuccess={handleEditComplete} 
              initialData={editingProject} 
              isEditing={true}
              projectId={editingProject.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={selectedProjectId !== null} onOpenChange={(open) => !open && setSelectedProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected project and may affect time entries associated with this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedProjectId && deleteProject.mutate(selectedProjectId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
