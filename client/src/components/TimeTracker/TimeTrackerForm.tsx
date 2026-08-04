import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import { Client, Project, TimeEntry } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import SimpleTimer from "./SimpleTimer";
import { useTimerContext } from "@/context/TimerContext";

interface TimeTrackerFormProps {
  onAddClient?: () => void;
  onAddProject?: (clientId: number) => void;
}

type TimeEntryWithRelations = TimeEntry & {
  client?: Client | null;
  project?: Project | null;
};

type TaskSuggestion = {
  key: string;
  description: string;
  projectId?: number;
  clientId?: number;
  project?: Project | null;
  client?: Client | null;
  lastTrackedAt: number;
  count: number;
};

export default function TimeTrackerForm({ onAddClient, onAddProject }: TimeTrackerFormProps = {}) {
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  
  // Use the proper time tracker hook for consistency
  const {
    description,
    setDescription,
    selectedClientId,
    setSelectedClientId,
    selectedProjectId,
    setSelectedProjectId,
    startTimerWithData,
  } = useTimerContext();
  
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
        
        // Timer state is managed by context, no need for local state
        
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

  // Fetch all projects but filter by client locally for better performance
  const { data: allProjects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json() as Promise<Project[]>;
    }
  });

  const { data: timeEntries = [] } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries"],
  });

  const taskSuggestions = useMemo<TaskSuggestion[]>(() => {
    const suggestions = new Map<string, TaskSuggestion>();
    const toTrackedAt = (entry: TimeEntryWithRelations) => {
      const rawDate = entry.endTime || entry.startTime || (entry.date ? `${entry.date}T12:00:00` : undefined);
      const trackedAt = rawDate ? new Date(rawDate).getTime() : 0;
      return Number.isFinite(trackedAt) ? trackedAt : 0;
    };

    timeEntries.forEach((entry) => {
      const entryDescription = entry.description?.trim();
      if (!entryDescription) return;

      const project = entry.project || allProjects.find((item) => item.id === entry.projectId) || null;
      const client =
        entry.client ||
        (project ? clients.find((item) => item.id === project.clientId) : undefined) ||
        (entry.clientId ? clients.find((item) => item.id === entry.clientId) : undefined) ||
        null;
      const projectId = project?.id || entry.projectId || undefined;
      const clientId = client?.id || project?.clientId || entry.clientId || undefined;
      const key = `${entryDescription.toLowerCase()}|${projectId || "none"}|${clientId || "none"}`;
      const lastTrackedAt = toTrackedAt(entry);
      const existing = suggestions.get(key);

      if (existing) {
        existing.count += 1;
        existing.lastTrackedAt = Math.max(existing.lastTrackedAt, lastTrackedAt);
        return;
      }

      suggestions.set(key, {
        key,
        description: entryDescription,
        projectId,
        clientId,
        project,
        client,
        lastTrackedAt,
        count: 1,
      });
    });

    return Array.from(suggestions.values()).sort((a, b) => b.lastTrackedAt - a.lastTrackedAt);
  }, [timeEntries, allProjects, clients]);

  const matchingTaskSuggestions = useMemo(() => {
    const query = description.trim().toLowerCase();
    if (query.length < 3) return [];

    return taskSuggestions
      .filter((suggestion) => suggestion.description.toLowerCase().includes(query))
      .sort((a, b) => {
        const aDescription = a.description.toLowerCase();
        const bDescription = b.description.toLowerCase();
        const aStartsWith = aDescription.startsWith(query);
        const bStartsWith = bDescription.startsWith(query);

        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
        if (a.count !== b.count) return b.count - a.count;
        return b.lastTrackedAt - a.lastTrackedAt;
      })
      .slice(0, 5);
  }, [description, taskSuggestions]);

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Filter projects based on selected client and search term
  const filteredProjects = allProjects.filter(project => {
    const matchesClient = selectedClientId ? project.clientId === selectedClientId : false;
    const matchesSearch = project.name.toLowerCase().includes(projectSearchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  });

  // Listen for play button events from time entries
  useEffect(() => {
    const handleStartTimerFromEntry = (event: CustomEvent) => {
      const { description: entryDescription, projectId, clientId } = event.detail;
      
      // Use the proper timer hook function for consistency
      startTimerWithData(entryDescription, projectId);
      
      // Update client selection if provided
      if (clientId) {
        setSelectedClientId(clientId);
      }
    };

    // Listen for both old and new event names
    window.addEventListener('startTimerFromEntry', handleStartTimerFromEntry as EventListener);
    window.addEventListener('startTimerWithMerging', handleStartTimerFromEntry as EventListener);
    
    return () => {
      window.removeEventListener('startTimerFromEntry', handleStartTimerFromEntry as EventListener);
      window.removeEventListener('startTimerWithMerging', handleStartTimerFromEntry as EventListener);
    };
  }, [startTimerWithData, setSelectedClientId]);

  // Close popovers when selections change (for automatic selection after creation)
  useEffect(() => {
    if (selectedClientId) {
      setClientPopoverOpen(false);
      setClientSearchTerm("");
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedProjectId) {
      setProjectPopoverOpen(false);
      setProjectSearchTerm("");
    }
  }, [selectedProjectId]);

  // Handle client selection
  const handleClientChange = (value: string) => {
    const clientId = Number(value);
    setSelectedClientId(clientId);
    setSelectedProjectId(undefined); // Reset project when client changes
  };

  const handleSuggestionSelect = (suggestion: TaskSuggestion) => {
    setDescription(suggestion.description);
    const projectClientId = suggestion.project?.clientId;

    setSelectedClientId(suggestion.clientId || projectClientId);
    setSelectedProjectId(suggestion.projectId);
    setClientSearchTerm("");
    setProjectSearchTerm("");
    setSuggestionsOpen(false);
  };

  const getSuggestionContext = (suggestion: TaskSuggestion) => {
    if (!suggestion.project?.name && !suggestion.client?.name) {
      return <span>No client or project</span>;
    }

    return (
      <>
        {suggestion.project?.name && (
          <span style={{ color: suggestion.project.color || "#6B7280" }}>
            {suggestion.project.name}
          </span>
        )}
        {suggestion.project?.name && suggestion.client?.name && <span> · </span>}
        {suggestion.client?.name && <span>{suggestion.client.name}</span>}
      </>
    );
  };

  const renderDescriptionInput = () => {
    const showSuggestions = suggestionsOpen && matchingTaskSuggestions.length > 0;

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-70"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="M6 8h.001"></path><path d="M10 8h.001"></path><path d="M14 8h.001"></path><path d="M18 8h.001"></path><path d="M8 12h.001"></path><path d="M12 12h.001"></path><path d="M16 12h.001"></path><path d="M7 16h10"></path></svg>
        </span>
        <Input
          type="text"
          placeholder="What are you working on?"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
          className="w-full pl-10"
          autoComplete="off"
        />

        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            <div className="max-h-64 overflow-y-auto p-1">
              {matchingTaskSuggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSuggestionSelect(suggestion);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {suggestion.description}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {getSuggestionContext(suggestion)}
                    </span>
                  </span>
                  {suggestion.count > 1 && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {suggestion.count}x
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tickd-card-elevated tickd-spacing-lg">
      <div className="max-w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:gap-2.5">
            <div className="w-full 2xl:flex-1">
              {renderDescriptionInput()}
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 2xl:w-72 2xl:flex-none 2xl:gap-2.5">
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedClientId ? 
                      clients.find(c => c.id === selectedClientId)?.name || "Select client" : 
                      "Select client"
                    }
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <div className="p-2">
                    <Input
                      placeholder="Search clients..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-gray-500">
                          No clients yet.
                        </div>
                      ) : filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded"
                          onClick={() => {
                            handleClientChange(client.id.toString());
                            setClientSearchTerm("");
                            setClientPopoverOpen(false);
                          }}
                        >
                          {selectedClientId === client.id && <Check className="h-4 w-4 mr-2" />}
                          <span className={selectedClientId === client.id ? "ml-0" : "ml-6"}>
                            {client.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-2 w-full justify-start border-t rounded-none pt-3 text-sm"
                      onClick={() => {
                        if (onAddClient) onAddClient();
                        setClientSearchTerm("");
                        setClientPopoverOpen(false);
                      }}
                    >
                      + Add new client
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between" 
                    disabled={!selectedClientId}
                  >
                    {selectedProjectId ? (
                      <span style={{ color: allProjects.find(p => p.id === selectedProjectId)?.color || "#000000" }}>
                        {allProjects.find(p => p.id === selectedProjectId)?.name || "Select project"}
                      </span>
                    ) : (
                      "Select project"
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <div className="p-2">
                    <Input
                      placeholder="Search projects..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-40 overflow-y-auto">
                      {filteredProjects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setProjectSearchTerm("");
                            setProjectPopoverOpen(false);
                          }}
                        >
                          {selectedProjectId === project.id && <Check className="h-4 w-4 mr-2" />}
                          <span 
                            className={selectedProjectId === project.id ? "ml-0" : "ml-6"}
                            style={{ color: (project as any).color || "#000000" }}
                          >
                            {project.name}
                          </span>
                        </div>
                      ))}
                      {selectedClientId && (
                        <div
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded border-t mt-1 pt-2"
                          onClick={() => {
                            if (onAddProject && selectedClientId) onAddProject(selectedClientId);
                            setProjectSearchTerm("");
                            setProjectPopoverOpen(false);
                          }}
                        >
                          <span className="ml-6">+ Add new project</span>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="w-full 2xl:w-auto 2xl:flex-none">
              <SimpleTimer 
                description={description}
                projectId={selectedProjectId || undefined}
                clientId={selectedClientId || undefined}
                isDisabled={!description}
                onStop={async (data) => {
                  // SimpleTimer handles the actual save — just refresh and reset
                  queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
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
