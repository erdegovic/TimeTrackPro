import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Lock, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AdminSummary = {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  backupStatus: string;
  restoreStatus: string;
};

type AdminUser = {
  id: number;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  role: "admin" | "user";
  status: "pending" | "active" | "inactive";
  createdAt?: string | null;
  updatedAt?: string | null;
  counts: {
    clients: number;
    projects: number;
    timeEntries: number;
    invoices: number;
    timeEntryNotes: number;
    creativityNotes: number;
    weeklyGoals: number;
  };
  backup: {
    latestSnapshotAt: string | null;
    status: string;
    restoreAvailable: boolean;
  };
};

const formatDate = (value?: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

export default function AdminPage() {
  const { toast } = useToast();
  const [adminEmail, setAdminEmail] = useState("");

  const { data: summary } = useQuery<AdminSummary>({
    queryKey: ["/api/admin/summary"],
  });

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const addAdmin = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/admin/admin-users", { email });
      return response.json();
    },
    onSuccess: () => {
      setAdminEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
      toast({
        title: "Admin role added",
        description: "That user can now access the private admin backend.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not add admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "active" | "inactive" }) => {
      const response = await apiRequest("POST", `/api/admin/users/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
      toast({ title: "User status updated" });
    },
  });

  const forceLogout = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/users/${id}/force-logout`);
    },
    onSuccess: () => {
      toast({
        title: "Sessions cleared",
        description: "The user will need to sign in again.",
      });
    },
  });

  const restoreUser = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/users/${id}/restore`);
    },
    onError: (error: Error) => {
      toast({
        title: "Restore is not configured yet",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-1 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4" />
            Private admin backend
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Recovery Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Operational account controls and recovery metadata only. Private project, note, invoice, and time-entry contents are not shown here.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle>{summary?.totalUsers ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active users</CardDescription>
            <CardTitle>{summary?.activeUsers ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admins</CardDescription>
            <CardTitle>{summary?.adminUsers ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Backups</CardDescription>
            <CardTitle className="text-base">Not configured</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            Add hidden admin email
          </CardTitle>
          <CardDescription>
            The email must already belong to a registered user. Use this to move admin access away from your public/private everyday email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              addAdmin.mutate(adminEmail);
            }}
          >
            <Input
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="hidden-admin@example.com"
              className="max-w-md"
            />
            <Button type="submit" disabled={addAdmin.isPending || !adminEmail.trim()}>
              Add admin role
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
          <CardDescription>
            Counts are shown for recovery confidence. Item names, descriptions, notes, and invoice contents stay private.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Recovery counts</th>
                    <th className="px-3 py-3">Backup</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{user.email}</div>
                        <div className="text-xs text-gray-500">
                          ID {user.id} / {user.username} / joined {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={user.status === "active" ? "secondary" : "outline"}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={user.role === "admin" ? "default" : "outline"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        <div>Clients: {user.counts.clients}</div>
                        <div>Projects: {user.counts.projects}</div>
                        <div>Time entries: {user.counts.timeEntries}</div>
                        <div>Invoices: {user.counts.invoices}</div>
                        <div>Notes/goals: {user.counts.timeEntryNotes + user.counts.creativityNotes + user.counts.weeklyGoals}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          Snapshot backups pending
                        </div>
                        <div className="mt-1 text-xs text-gray-500">Latest: {formatDate(user.backup.latestSnapshotAt)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => forceLogout.mutate(user.id)}
                            disabled={forceLogout.isPending}
                          >
                            <Lock className="mr-2 h-4 w-4" />
                            Force logout
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatus.mutate({ id: user.id, status: user.status === "active" ? "inactive" : "active" })}
                            disabled={updateStatus.isPending}
                          >
                            {user.status === "active" ? "Freeze" : "Activate"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreUser.mutate(user.id)}
                            disabled
                            title="Restore will be enabled after encrypted backup snapshots are implemented."
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
