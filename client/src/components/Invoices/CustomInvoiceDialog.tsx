import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mic, MicOff, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Client, Project, Settings } from "@shared/schema";
import type { ManualInvoiceItem } from "@shared/invoice-line-items";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import InvoicePreview from "./InvoicePreview";

type CreationMode = "custom" | "voice";

type DraftItem = {
  id: string;
  description: string;
  hours: string;
  rate: string;
  amount: string;
};

type VoiceDraftResponse = {
  clientId: number;
  projectId: number | null;
  showHours: boolean;
  showHourlyRate: boolean;
  items: Array<{ description: string; hours: number; rate: number; amount: number }>;
  summary: string;
};

type CustomInvoiceDialogProps = {
  open: boolean;
  mode: CreationMode;
  clients: Client[];
  settings?: Settings;
  onOpenChange: (open: boolean) => void;
};

const newDraftItem = (rate = 0): DraftItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  description: "",
  hours: "1",
  rate: rate ? String(rate) : "",
  amount: "",
});

const numberOrZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export default function CustomInvoiceDialog({ open, mode, clients, settings, onOpenChange }: CustomInvoiceDialogProps) {
  const { toast } = useToast();
  const [stage, setStage] = useState<"compose" | "preview">("compose");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [showHours, setShowHours] = useState(false);
  const [showHourlyRate, setShowHourlyRate] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [instruction, setInstruction] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isEditingPreview, setIsEditingPreview] = useState(true);
  const recognitionRef = useRef<any>(null);

  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"], enabled: open });
  const selectedClient = clients.find((client) => client.id === Number(clientId));
  const selectedProject = projects.find((project) => project.id === Number(projectId));
  const availableProjects = projects.filter((project) => project.clientId === Number(clientId));

  useEffect(() => {
    if (!open) return;
    setStage("compose");
    setClientId("");
    setProjectId("none");
    setShowHours(false);
    setShowHourlyRate(false);
    setItems([newDraftItem()]);
    setInstruction("");
    setIsEditingPreview(true);
  }, [open, mode]);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const voiceDraft = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ultimate/invoice-draft/interpret", { instruction });
      return response.json() as Promise<VoiceDraftResponse>;
    },
    onSuccess: (draft) => {
      setClientId(String(draft.clientId));
      setProjectId(draft.projectId ? String(draft.projectId) : "none");
      setShowHours(draft.showHours);
      setShowHourlyRate(draft.showHours && draft.showHourlyRate);
      setItems(draft.items.map((item) => ({
        id: newDraftItem().id,
        description: item.description,
        hours: String(item.hours || 0),
        rate: String(item.rate || 0),
        amount: String(item.amount || 0),
      })));
      queryClient.invalidateQueries({ queryKey: ["/api/ultimate/status"] });
      toast({ title: "Invoice draft ready", description: draft.summary || "Review every item before previewing the invoice." });
    },
    onError: (error: Error) => toast({
      title: "Could not create the invoice draft",
      description: error.message,
      variant: "destructive",
    }),
  });

  const updateItem = (id: string, field: keyof Omit<DraftItem, "id">, value: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    const project = projects.find((candidate) => candidate.id === Number(value));
    const rate = Number(project?.hourlyRate || 0);
    if (rate > 0) {
      setItems((current) => current.map((item) => numberOrZero(item.rate) === 0 ? { ...item, rate: String(rate) } : item));
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Voice input is unavailable", description: "Use a current version of Chrome or Edge, or type the invoice request instead.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setInstruction((current) => `${current}${current ? " " : ""}${transcript}`.trim());
    };
    recognition.onerror = () => toast({ title: "Microphone input stopped", description: "Check browser microphone permission and try again.", variant: "destructive" });
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const validationMessage = useMemo(() => {
    if (!selectedClient) return "Choose a client.";
    if (items.length === 0) return "Add at least one invoice item.";
    if (items.some((item) => item.description.trim().length === 0)) return "Give every item a description.";
    if (showHours && items.some((item) => numberOrZero(item.hours) <= 0)) return "Hours must be greater than zero.";
    if (showHours && items.some((item) => numberOrZero(item.rate) <= 0)) return "Every hourly item needs a rate greater than zero.";
    if (!showHours && items.some((item) => numberOrZero(item.amount) <= 0)) return "Every fixed-price item needs an amount greater than zero.";
    return "";
  }, [items, selectedClient, showHours]);

  const manualItems = useMemo<ManualInvoiceItem[]>(() => items.map((item) => {
    const hours = numberOrZero(item.hours);
    const rate = numberOrZero(item.rate);
    const amount = numberOrZero(item.amount);
    return showHours
      ? {
          id: item.id,
          description: item.description.trim(),
          billingType: "hourly",
          hours,
          rate,
          amount: Number((hours * rate).toFixed(2)),
          projectName: selectedProject?.name || "",
          displayHours: true,
          displayRate: showHourlyRate,
        }
      : {
          id: item.id,
          description: item.description.trim(),
          billingType: "quantity",
          quantity: 1,
          rate: amount,
          amount,
          projectName: selectedProject?.name || "",
          displayHours: false,
          displayRate: false,
        };
  }), [items, selectedProject?.name, showHourlyRate, showHours]);

  const reportData = useMemo(() => ({
    timeEntries: [],
    weeklyData: [],
    groups: [],
    clientCurrency: selectedClient?.currency || settings?.defaultCurrency || "USD",
    totalHours: showHours ? manualItems.reduce((sum, item) => sum + Number(item.hours || 0), 0) : 0,
    totalAmount: manualItems.reduce((sum, item) => sum + item.amount, 0),
    timeFormat: settings?.defaultTimeFormat || "decimal",
  }), [manualItems, selectedClient?.currency, settings?.defaultCurrency, settings?.defaultTimeFormat, showHours]);

  const close = (nextOpen: boolean) => {
    if (!nextOpen) stopListening();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={stage === "preview" ? "max-w-6xl" : "max-w-3xl"}>
        {stage === "preview" && selectedClient ? (
          <>
            <DialogHeader className="pr-8">
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={() => setStage("compose")} aria-label="Back to invoice details">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <DialogTitle>Custom invoice preview</DialogTitle>
                  <DialogDescription>Review, edit, save, or export the invoice for {selectedClient.name}.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <InvoicePreview
              key={`${clientId}-${projectId}-${manualItems.map((item) => item.id).join("-")}`}
              reportData={reportData}
              clientId={selectedClient.id}
              client={selectedClient}
              settings={settings}
              additionalItems={manualItems}
              isEditing={isEditingPreview}
              onEditInvoice={() => setIsEditingPreview((current) => !current)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{mode === "voice" ? "Create an invoice with voice" : "Create a custom invoice"}</DialogTitle>
              <DialogDescription>
                {mode === "voice"
                  ? "Describe the client and charges, then review the editable draft before anything is saved."
                  : "Build a fixed-price or hourly invoice without using tracked time."}
              </DialogDescription>
            </DialogHeader>

            {mode === "voice" && (
              <div className="rounded-md border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Tell Tickd what to invoice
                </div>
                <Textarea
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder='Example: “Invoice Northwind Studio for two logo concepts at £250 each.”'
                  className="mt-3 min-h-24 bg-white"
                  maxLength={3000}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={isListening ? stopListening : startListening}>
                    {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {isListening ? "Stop listening" : "Use microphone"}
                  </Button>
                  <Button type="button" onClick={() => voiceDraft.mutate()} disabled={instruction.trim().length < 3 || voiceDraft.isPending}>
                    {voiceDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Build editable draft
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select value={clientId} onValueChange={(value) => { setClientId(value); setProjectId("none"); }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project <span className="font-normal text-gray-500">(optional)</span></Label>
                <Select value={projectId} onValueChange={handleProjectChange} disabled={!clientId}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {availableProjects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4 sm:flex-row sm:items-center sm:gap-8">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
                <Switch checked={showHours} onCheckedChange={(checked) => { setShowHours(checked); if (!checked) setShowHourlyRate(false); }} />
                Include hours
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
                <Switch checked={showHourlyRate} disabled={!showHours} onCheckedChange={setShowHourlyRate} />
                Display hourly rate
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Invoice items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, newDraftItem(Number(selectedProject?.hourlyRate || 0))])}>
                  <Plus className="mr-2 h-4 w-4" /> Add item
                </Button>
              </div>
              {items.map((item, index) => (
                <div key={item.id} className="grid items-end gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`item-description-${item.id}`}>Item {index + 1}</Label>
                    <Input id={`item-description-${item.id}`} value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} placeholder="Service or deliverable" />
                  </div>
                  {showHours ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor={`item-hours-${item.id}`}>Hours</Label>
                        <Input id={`item-hours-${item.id}`} type="number" min="0" step="0.01" value={item.hours} onChange={(event) => updateItem(item.id, "hours", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`item-rate-${item.id}`}>Rate{selectedClient?.currency ? ` (${selectedClient.currency})` : ""}</Label>
                        <Input id={`item-rate-${item.id}`} type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(item.id, "rate", event.target.value)} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`item-amount-${item.id}`}>Amount{selectedClient?.currency ? ` (${selectedClient.currency})` : ""}</Label>
                      <Input id={`item-amount-${item.id}`} type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateItem(item.id, "amount", event.target.value)} />
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove item ${index + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-600" aria-live="polite">{validationMessage}</p>
              <Button type="button" className="sm:ml-auto" disabled={Boolean(validationMessage)} onClick={() => setStage("preview")}>Preview invoice</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
