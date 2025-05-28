import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { InsertProject, Client } from "@shared/schema";

// Extended schema with validation
const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().min(1, "Client is required"),
  description: z.string().optional(),
  active: z.boolean().default(true),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate format").default("0"),
  color: z.string().default("#3B82F6"),
});

// Predefined color options for projects
const projectColors = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#6B7280", // Gray
];

type ProjectFormProps = {
  onSuccess: () => void;
  initialData?: Omit<InsertProject, "clientId"> & { clientId: number | string };
  isEditing?: boolean;
  projectId?: number;
};

export default function ProjectForm({ onSuccess, initialData, isEditing = false, projectId }: ProjectFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Initialize form with default values
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || "",
      clientId: initialData?.clientId ? initialData.clientId.toString() : "",
      description: initialData?.description || "",
      active: initialData?.active !== undefined ? initialData.active : true,
      hourlyRate: initialData?.hourlyRate?.toString() || "0",
      color: (initialData as any)?.color || "#3B82F6",
    },
  });

  // Create mutation
  const createProject = useMutation({
    mutationFn: async (data: z.infer<typeof projectSchema>) => {
      const projectData = {
        ...data,
        clientId: parseInt(data.clientId),
        hourlyRate: data.hourlyRate || "0",
      };
      return apiRequest("POST", "/api/projects", projectData);
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the data everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      
      toast({
        title: "Project created",
        description: "New project has been created successfully.",
      });
      onSuccess();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Update mutation
  const updateProject = useMutation({
    mutationFn: async (data: z.infer<typeof projectSchema>) => {
      const projectData = {
        ...data,
        clientId: parseInt(data.clientId),
        hourlyRate: data.hourlyRate || "0",
      };
      return apiRequest("PUT", `/api/projects/${projectId}`, projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({
        title: "Project updated",
        description: "Project has been updated successfully.",
      });
      onSuccess();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: z.infer<typeof projectSchema>) => {
    setIsSubmitting(true);
    if (isEditing && projectId) {
      updateProject.mutate(data);
    } else {
      createProject.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter project name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client *</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter project description"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hourlyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hourly Rate {form.getValues('clientId') ? 
                  `(${clients?.find(c => c.id === Number(form.getValues('clientId')))?.currency || 'USD'})` : 
                  '(USD)'
                }</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">
                  Rate is shown in the client's currency
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Color</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap gap-2">
                    {projectColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${
                          field.value === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                        title={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">
                  This color will be used to identify the project throughout the app
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Active Project</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    This project will be available for time tracking
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
