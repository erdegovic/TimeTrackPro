import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClientForm from "@/components/Clients/ClientForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@shared/schema";

export default function ClientsPage() {
  const { toast } = useToast();
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  
  // Fetch clients
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Delete client mutation
  const deleteClient = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      });
      setSelectedClientId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the client. Make sure no projects or time entries are associated with this client.",
        variant: "destructive",
      });
    }
  });
  
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
  };
  
  const handleEditComplete = () => {
    setEditingClient(null);
  };
  
  const columns = [
    {
      header: "Name",
      accessorKey: "name",
      className: "font-medium",
    },
    {
      header: "Email",
      accessorKey: "email",
    },
    {
      header: "Phone",
      accessorKey: "phone",
    },
    {
      header: "City",
      accessorKey: (row: Client) => (row.city && row.state ? `${row.city}, ${row.state}` : (row.city || "")),
    },
    {
      header: "Country",
      accessorKey: "country",
    },
    {
      header: "Actions",
      accessorKey: (row: Client) => (
        <div className="flex space-x-1 justify-end">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleEditClient(row)}
            className="h-8 w-8 flex-shrink-0"
            title="Edit Client"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedClientId(row.id)}
            className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive/80"
            title="Delete Client"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        <Button onClick={() => setShowNewClientDialog(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>
            Manage your clients and their contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <DataTable
              data={clients}
              columns={columns}
              isLoading={isLoading}
            emptyState={
              <div className="text-center py-8 text-gray-500">
                <User className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No clients</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You haven't added any clients yet. Add a client to get started.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowNewClientDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </div>
            }
          />
          </div>
        </CardContent>
      </Card>

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="w-[95vw] max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm onSuccess={() => setShowNewClientDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editingClient !== null} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="w-[95vw] max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm 
              onSuccess={handleEditComplete} 
              initialData={editingClient} 
              isEditing={true}
              clientId={editingClient.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={selectedClientId !== null} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected client and may affect projects and time entries associated with this client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedClientId && deleteClient.mutate(selectedClientId)}
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
