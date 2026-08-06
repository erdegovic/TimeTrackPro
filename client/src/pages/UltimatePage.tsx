import { useMemo, useState } from "react";
import { addDays, endOfMonth, format, isValid, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Loader2,
  Lock,
  Mail,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUltimateCapabilities } from "@shared/subscriptions";
import type { Client, TimeEntry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UltimateStatus = {
  enabled: boolean;
  consentedAt: string | null;
  configured: boolean;
  usage: { actionsUsed: number; actionsLimit: number; estimatedCostMicros: number; resetsAt: string };
};

type PolishResult = {
  artifactId: string;
  suggestions: Array<{
    entryId: number;
    originalDescription: string;
    polishedDescription: string;
    reason: string;
  }>;
};

type ReviewResult = {
  artifactId: string;
  headline: string;
  summary: string;
  accomplishments: string[];
  insights: string[];
  checks: string[];
  clientReadySummary: string;
  totals: { entries: number; hours: number };
};

type AutomationData = {
  schedules: Array<any>;
  jobs: Array<any>;
};

const statusStyles: Record<string, string> = {
  pending_approval: "border-amber-200 bg-amber-50 text-amber-800",
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  needs_attention: "border-orange-200 bg-orange-50 text-orange-800",
  cancelled: "border-gray-200 bg-gray-50 text-gray-600",
};

const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());

type SchedulePeriodMode = "previous_month" | "specific_month" | "custom_range";

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
};

const getMonthPeriod = (month: string) => {
  if (!/^\d{4}-\d{2}$/.test(month)) return { startDate: "", endDate: "" };
  const date = parseISO(`${month}-01`);
  if (!isValid(date)) return { startDate: "", endDate: "" };
  return {
    startDate: format(startOfMonth(date), "yyyy-MM-dd"),
    endDate: format(endOfMonth(date), "yyyy-MM-dd"),
  };
};

const getRecommendedPreparationDate = (endDate: string) => {
  const today = format(new Date(), "yyyy-MM-dd");
  if (!isCalendarDate(endDate)) return today;
  const firstAvailableDate = format(addDays(parseISO(endDate), 1), "yyyy-MM-dd");
  return firstAvailableDate > today ? firstAvailableDate : today;
};

const formatPeriod = (startDate?: string | null, endDate?: string | null) => {
  if (!startDate || !endDate) return "Choose an invoice period";
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return "Choose a valid invoice period";
  return `${format(parseISO(startDate), "MMM d, yyyy")} - ${format(parseISO(endDate), "MMM d, yyyy")}`;
};

export default function UltimatePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const access = getUltimateCapabilities(user?.subscriptionPlan, user?.subscriptionStatus);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<number[]>([]);
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientFilter, setClientFilter] = useState("all");
  const [styleClientId, setStyleClientId] = useState("");
  const [tone, setTone] = useState("concise");
  const [language, setLanguage] = useState("English");
  const [terminology, setTerminology] = useState("");
  const [instructions, setInstructions] = useState("");

  const { data: status } = useQuery<UltimateStatus>({
    queryKey: ["/api/ultimate/status"],
    enabled: access.canUseAi,
  });
  const { data: entries = [] } = useQuery<TimeEntry[]>({ queryKey: ["/api/time-entries"], enabled: access.canUseAi });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"], enabled: access.canUseAi });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["/api/projects"], enabled: access.canUseAi });
  const { data: automation } = useQuery<AutomationData>({
    queryKey: ["/api/ultimate/automation"],
    enabled: access.canAutomateInvoices,
  });

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (entry.date < startDate || entry.date > endDate) return false;
    if (clientFilter === "all") return true;
    const project = projects.find((item) => item.id === entry.projectId);
    return String(entry.clientId || project?.clientId || "") === clientFilter;
  }), [clientFilter, endDate, entries, projects, startDate]);

  const preferencesMutation = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("PUT", "/api/ultimate/preferences", { enabled, acknowledged: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ultimate/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "AI assistance updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update AI assistance", description: error.message, variant: "destructive" }),
  });

  const polishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ultimate/polish", { entryIds: selectedEntryIds });
      return response.json() as Promise<PolishResult>;
    },
    onSuccess: (result) => {
      setPolishResult(result);
      setSelectedSuggestionIds(result.suggestions.map((item) => item.entryId));
      queryClient.invalidateQueries({ queryKey: ["/api/ultimate/status"] });
    },
    onError: (error: Error) => toast({ title: "Polish draft failed", description: error.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ultimate/artifacts/${polishResult?.artifactId}/apply`, { entryIds: selectedSuggestionIds }),
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setPolishResult(null);
      setSelectedEntryIds([]);
      toast({ title: "Descriptions updated", description: `${result.updatedCount} entries were polished${result.skippedCount ? `; ${result.skippedCount} changed entries were left alone` : ""}.` });
    },
    onError: (error: Error) => toast({ title: "Could not apply suggestions", description: error.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ultimate/review", {
        startDate,
        endDate,
        clientId: clientFilter === "all" ? undefined : Number(clientFilter),
        mode: "work_review",
      });
      return response.json() as Promise<ReviewResult>;
    },
    onSuccess: (result) => {
      setReviewResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/ultimate/status"] });
    },
    onError: (error: Error) => toast({ title: "Review could not be prepared", description: error.message, variant: "destructive" }),
  });

  const styleMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/ultimate/clients/${styleClientId}/preferences`, { tone, language, terminology, instructions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client writing style saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save writing style", description: error.message, variant: "destructive" }),
  });

  if (!access.canUseAi) {
    return <UltimateUpsell />;
  }

  const usagePercent = status ? Math.min(100, status.usage.actionsUsed / status.usage.actionsLimit * 100) : 0;
  const allFilteredSelected = filteredEntries.length > 0 && filteredEntries.every((entry) => selectedEntryIds.includes(entry.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600"><Sparkles className="h-4 w-4" />Tickd Ultimate</div>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Smart Assistant</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Turn tracked work into polished communication and prepare recurring invoices with an auditable review step.</p>
        </div>
        <div className="w-full rounded-md border bg-white p-3 sm:w-64">
          <div className="flex items-center justify-between text-xs"><span className="font-medium text-gray-600">Smart Actions</span><span className="text-gray-500">{status?.usage.actionsUsed || 0} / {status?.usage.actionsLimit || 100}</span></div>
          <Progress value={usagePercent} className="mt-2 h-2" />
          <p className="mt-2 text-xs text-gray-500">Resets monthly. Usage appears only when an AI result is completed.</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div>
          <p className="text-sm font-semibold text-blue-950">AI processing is optional</p>
          <p className="mt-1 max-w-3xl text-sm text-blue-800">Only the selected entry descriptions, dates, durations, project names, and client context are sent for the requested action. Private notes and unrelated account data are excluded. Suggestions never replace entries until you approve them.</p>
        </div>
        <Switch checked={status?.enabled === true} onCheckedChange={(enabled) => preferencesMutation.mutate(enabled)} disabled={preferencesMutation.isPending} aria-label="Enable AI assistance" />
      </div>

      {!status?.configured && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">AI connection pending</p><p className="mt-1">Invoice automation can still validate and group work, but writing assistance needs the server API key.</p></div>
        </div>
      )}

      <Tabs defaultValue="assistant">
        <TabsList className="grid w-full grid-cols-2 sm:w-[420px]">
          <TabsTrigger value="assistant"><WandSparkles className="mr-2 h-4 w-4" />Work assistant</TabsTrigger>
          <TabsTrigger value="automation"><CalendarClock className="mr-2 h-4 w-4" />Invoice automation</TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="mt-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose the work to review</CardTitle>
              <CardDescription>The same selection powers entry polishing and the work review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor="ultimate-start">From</Label><Input id="ultimate-start" className="mt-1" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></div>
                <div><Label htmlFor="ultimate-end">To</Label><Input id="ultimate-end" className="mt-1" type="date" value={endDate} min={startDate} max={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setEndDate(event.target.value)} /></div>
                <div><Label>Client</Label><Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <div className="flex items-center gap-3 border-b bg-gray-50 px-4 py-3">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => setSelectedEntryIds(checked ? filteredEntries.map((entry) => entry.id) : [])} aria-label="Select all visible entries" />
                  <span className="text-sm font-medium text-gray-700">{filteredEntries.length} entries in this selection</span>
                </div>
                <div className="max-h-72 divide-y overflow-y-auto">
                  {filteredEntries.length ? filteredEntries.map((entry) => {
                    const project = projects.find((item) => item.id === entry.projectId);
                    const client = clients.find((item) => item.id === (entry.clientId || project?.clientId));
                    return <label key={entry.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50">
                      <Checkbox className="mt-0.5" checked={selectedEntryIds.includes(entry.id)} onCheckedChange={(checked) => setSelectedEntryIds((current) => checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-900">{entry.description || "Untitled entry"}</span><span className="mt-0.5 block text-xs text-gray-500">{entry.date} · {project?.name || "No project"} · {client?.name || "No client"}</span></span>
                      <span className="font-mono text-xs text-gray-600">{Number(entry.duration || 0).toFixed(2)}h</span>
                    </label>;
                  }) : <p className="px-4 py-10 text-center text-sm text-gray-500">No entries match this range.</p>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => polishMutation.mutate()} disabled={!status?.enabled || !selectedEntryIds.length || polishMutation.isPending}>
                  {polishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Polish selected entries
                </Button>
                <Button variant="outline" onClick={() => reviewMutation.mutate()} disabled={!status?.enabled || !filteredEntries.length || reviewMutation.isPending}>
                  {reviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}Review this work
                </Button>
              </div>
            </CardContent>
          </Card>

          {polishResult && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Polish draft</CardTitle><CardDescription>Compare every suggestion. Entries that change in the meantime are automatically skipped.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {polishResult.suggestions.map((suggestion) => <label key={suggestion.entryId} className="grid cursor-pointer gap-3 rounded-md border p-4 sm:grid-cols-[24px_1fr_1fr]">
                  <Checkbox className="mt-1" checked={selectedSuggestionIds.includes(suggestion.entryId)} onCheckedChange={(checked) => setSelectedSuggestionIds((current) => checked ? [...current, suggestion.entryId] : current.filter((id) => id !== suggestion.entryId))} />
                  <div><p className="text-xs font-semibold uppercase text-gray-500">Original</p><p className="mt-1 text-sm text-gray-600">{suggestion.originalDescription}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-blue-600">Suggested</p><p className="mt-1 text-sm font-medium text-gray-900">{suggestion.polishedDescription}</p><p className="mt-1 text-xs text-gray-500">{suggestion.reason}</p></div>
                </label>)}
                <div className="flex gap-2 pt-2"><Button onClick={() => applyMutation.mutate()} disabled={!selectedSuggestionIds.length || applyMutation.isPending}>{applyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Apply selected</Button><Button variant="outline" onClick={() => setPolishResult(null)}>Discard draft</Button></div>
              </CardContent>
            </Card>
          )}

          {reviewResult && <WorkReview result={reviewResult} onCopy={() => navigator.clipboard.writeText(reviewResult.clientReadySummary).then(() => toast({ title: "Client summary copied" }))} />}

          <Card>
            <CardHeader><CardTitle className="text-lg">Client writing style</CardTitle><CardDescription>Saved per client and used when Tickd prepares invoice wording and emails.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Client</Label><Select value={styleClientId} onValueChange={(value) => {
                  setStyleClientId(value);
                  const raw = (clients.find((client) => client.id === Number(value)) as any)?.aiPreferences;
                  try { const parsed = JSON.parse(raw || "{}"); setTone(parsed.tone || "concise"); setLanguage(parsed.language || "English"); setTerminology(parsed.terminology || ""); setInstructions(parsed.instructions || ""); } catch {}
                }}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Tone</Label><Select value={tone} onValueChange={setTone}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="concise">Concise</SelectItem><SelectItem value="warm">Warm</SelectItem><SelectItem value="formal">Formal</SelectItem><SelectItem value="detailed">Detailed</SelectItem></SelectContent></Select></div>
                <div><Label htmlFor="style-language">Language</Label><Input id="style-language" className="mt-1" value={language} onChange={(event) => setLanguage(event.target.value)} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="style-terms">Preferred terminology</Label><Textarea id="style-terms" className="mt-1" placeholder="Example: Use campaign, not project" value={terminology} onChange={(event) => setTerminology(event.target.value)} /></div><div><Label htmlFor="style-instructions">Writing notes</Label><Textarea id="style-instructions" className="mt-1" placeholder="Client-specific context that is safe to use in invoices" value={instructions} onChange={(event) => setInstructions(event.target.value)} /></div></div>
              <Button variant="outline" onClick={() => styleMutation.mutate()} disabled={!styleClientId || styleMutation.isPending}>{styleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save writing style</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-5 space-y-6">
          <ScheduleComposer clients={clients} onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/ultimate/automation"] })} />
          <ScheduleList schedules={automation?.schedules || []} onChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/ultimate/automation"] })} />
          <ApprovalQueue jobs={automation?.jobs || []} onChanged={() => { queryClient.invalidateQueries({ queryKey: ["/api/ultimate/automation"] }); queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UltimateUpsell() {
  return <div className="mx-auto max-w-4xl py-10"><div className="rounded-md border bg-white p-8 sm:p-12"><div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600"><Sparkles className="h-5 w-5" /></div><p className="mt-6 text-sm font-semibold text-blue-600">Tickd Ultimate</p><h1 className="mt-2 text-3xl font-semibold text-gray-950">Let Tickd prepare the admin.</h1><p className="mt-3 max-w-2xl text-gray-600">Polish time entries, review completed work, prepare client-ready summaries, and run recurring invoices through a controlled approval queue.</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{[[WandSparkles,"Client-ready wording"],[ClipboardCheck,"Useful work reviews"],[CalendarClock,"Smart recurring invoices"]].map(([Icon,label]: any) => <div key={label} className="flex items-center gap-3 rounded-md border p-3 text-sm font-medium"><Icon className="h-4 w-4 text-blue-600" />{label}</div>)}</div><Button asChild className="mt-8"><Link href="/plans"><Lock className="mr-2 h-4 w-4" />View Ultimate</Link></Button></div></div>;
}

function WorkReview({ result, onCopy }: { result: ReviewResult; onCopy: () => void }) {
  return <Card><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">{result.totals.hours.toFixed(2)} hours · {result.totals.entries} entries</p><CardTitle className="mt-1 text-xl">{result.headline}</CardTitle><CardDescription className="mt-2 max-w-3xl">{result.summary}</CardDescription></div><Button variant="outline" size="sm" onClick={onCopy}>Copy client summary</Button></div></CardHeader><CardContent className="grid gap-6 lg:grid-cols-3"><ReviewList title="Accomplishments" icon={CheckCircle2} items={result.accomplishments} /><ReviewList title="Work patterns" icon={Clock3} items={result.insights} /><ReviewList title="Checks before billing" icon={FileCheck2} items={result.checks} /><div className="rounded-md border border-blue-200 bg-blue-50 p-4 lg:col-span-3"><p className="text-xs font-semibold uppercase text-blue-700">Client-ready summary</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-950">{result.clientReadySummary}</p></div></CardContent></Card>;
}

function ReviewList({ title, icon: Icon, items }: { title: string; icon: any; items: string[] }) {
  return <div><div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Icon className="h-4 w-4 text-blue-600" />{title}</div><ul className="mt-3 space-y-2">{items.map((item, index) => <li key={index} className="text-sm leading-5 text-gray-600">{item}</li>)}</ul></div>;
}

function ScheduleComposer({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const defaultMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const defaultPeriod = getMonthPeriod(defaultMonth);
  const [periodMode, setPeriodMode] = useState<SchedulePeriodMode>("previous_month");
  const [specificMonth, setSpecificMonth] = useState(defaultMonth);
  const [periodStart, setPeriodStart] = useState(defaultPeriod.startDate);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.endDate);
  const [prepareDate, setPrepareDate] = useState(getRecommendedPreparationDate(defaultPeriod.endDate));
  const [billingDay, setBillingDay] = useState("1");
  const [sendHour, setSendHour] = useState("9");
  const [autoSend, setAutoSend] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState("60");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const isRecurring = periodMode === "previous_month";
  const selectedPeriod = periodMode === "specific_month"
    ? getMonthPeriod(specificMonth)
    : { startDate: periodStart, endDate: periodEnd };
  const earliestPrepareDate = isCalendarDate(selectedPeriod.endDate)
    ? format(addDays(parseISO(selectedPeriod.endDate), 1), "yyyy-MM-dd")
    : undefined;
  const oneTimePeriodValid = isRecurring || Boolean(
    isCalendarDate(selectedPeriod.startDate) &&
    isCalendarDate(selectedPeriod.endDate) &&
    selectedPeriod.startDate <= selectedPeriod.endDate &&
    isCalendarDate(prepareDate) &&
    prepareDate > selectedPeriod.endDate,
  );

  const choosePeriodMode = (value: string) => {
    const mode = value as SchedulePeriodMode;
    setPeriodMode(mode);
    if (mode === "specific_month") {
      const period = getMonthPeriod(specificMonth);
      setPrepareDate(getRecommendedPreparationDate(period.endDate));
    } else if (mode === "custom_range") {
      setPrepareDate(getRecommendedPreparationDate(periodEnd));
    }
  };

  const mutation = useMutation({
    mutationFn: () => {
      const client = clients.find((item) => item.id === Number(clientId));
      const periodName = periodMode === "specific_month"
        ? (specificMonth ? format(parseISO(`${specificMonth}-01`), "MMMM yyyy") : "selected month")
        : periodMode === "custom_range" ? "custom period" : "monthly";
      return apiRequest("POST", "/api/ultimate/schedules", {
        clientId: Number(clientId),
        name: `${client?.name || "Client"} ${periodName} invoice`,
        enabled: true,
        periodMode,
        periodStart: isRecurring ? null : selectedPeriod.startDate,
        periodEnd: isRecurring ? null : selectedPeriod.endDate,
        prepareDate: isRecurring ? undefined : prepareDate,
        billingDay: Number(billingDay),
        sendHour: Number(sendHour),
        timezone,
        requireApproval: !autoSend,
        cancellationWindowMinutes: Number(windowMinutes),
      });
    },
    onSuccess: () => { onCreated(); toast({ title: isRecurring ? "Monthly schedule created" : "Invoice period scheduled" }); },
    onError: (error: Error) => toast({ title: "Could not create schedule", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Schedule invoice preparation</CardTitle>
        <CardDescription>Use the usual monthly cycle or save an exact one-time billing period for irregular work.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label>Invoice period</Label>
          <Tabs value={periodMode} onValueChange={choosePeriodMode} className="mt-2">
            <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="previous_month" className="min-h-10">Previous month</TabsTrigger>
              <TabsTrigger value="specific_month" className="min-h-10">Specific month</TabsTrigger>
              <TabsTrigger value="custom_range" className="min-h-10">Custom range</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose client" /></SelectTrigger>
              <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}{!client.email ? " · email needed" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {periodMode === "specific_month" && (
            <div>
              <Label htmlFor="invoice-month">Month</Label>
              <Input id="invoice-month" className="mt-1" type="month" value={specificMonth} onChange={(event) => {
                setSpecificMonth(event.target.value);
                if (event.target.value) setPrepareDate(getRecommendedPreparationDate(getMonthPeriod(event.target.value).endDate));
              }} />
            </div>
          )}
        </div>

        {periodMode === "custom_range" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="period-start">Period starts</Label><Input id="period-start" className="mt-1" type="date" value={periodStart} max={periodEnd} onChange={(event) => setPeriodStart(event.target.value)} /></div>
            <div><Label htmlFor="period-end">Period ends</Label><Input id="period-end" className="mt-1" type="date" value={periodEnd} min={periodStart} onChange={(event) => { setPeriodEnd(event.target.value); if (event.target.value) setPrepareDate(getRecommendedPreparationDate(event.target.value)); }} /></div>
          </div>
        )}

        {!isRecurring && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-950">One-time period: {formatPeriod(selectedPeriod.startDate, selectedPeriod.endDate)}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="prepare-date">Prepare on</Label><Input id="prepare-date" className="mt-1 bg-white" type="date" min={earliestPrepareDate} value={prepareDate} onChange={(event) => setPrepareDate(event.target.value)} /></div>
              <div><Label>Prepare at</Label><Select value={sendHour} onValueChange={setSendHour}><SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2,"0")}:00</SelectItem>)}</SelectContent></Select></div>
            </div>
            <p className="mt-2 text-xs text-blue-800">This schedule completes after Tickd prepares the selected period once.</p>
          </div>
        )}

        {isRecurring && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="billing-day">Prepare every month on day</Label><Input id="billing-day" className="mt-1" type="number" min="1" max="28" value={billingDay} onChange={(event) => setBillingDay(event.target.value)} /></div>
            <div><Label>Prepare at</Label><Select value={sendHour} onValueChange={setSendHour}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2,"0")}:00</SelectItem>)}</SelectContent></Select></div>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-md border bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-gray-900">Send automatically after checks</p><p className="mt-0.5 text-sm text-gray-500">When off, every prepared invoice waits for approval.</p></div>
          <Switch checked={autoSend} onCheckedChange={setAutoSend} aria-label="Send automatically after checks" />
        </div>
        {autoSend && <div className="max-w-xs"><Label htmlFor="cancel-window">Cancellation window</Label><Select value={windowMinutes} onValueChange={setWindowMinutes}><SelectTrigger id="cancel-window" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem><SelectItem value="360">6 hours</SelectItem><SelectItem value="1440">24 hours</SelectItem></SelectContent></Select></div>}
        {!oneTimePeriodValid && <p className="text-sm text-red-600">The preparation date must be after the selected invoice period.</p>}
        <Button onClick={() => mutation.mutate()} disabled={!clientId || !oneTimePeriodValid || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
          {isRecurring ? "Create monthly schedule" : "Schedule this period"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScheduleList({ schedules, onChanged }: { schedules: any[]; onChanged: () => void }) {
  const { toast } = useToast();
  const action = useMutation({ mutationFn: ({ method, url, data }: any) => apiRequest(method, url, data), onSuccess: () => { onChanged(); toast({ title: "Schedule updated" }); }, onError: (error: Error) => toast({ title: "Schedule action failed", description: error.message, variant: "destructive" }) });
  return <Card><CardHeader><CardTitle className="text-lg">Schedules</CardTitle><CardDescription>Recurring monthly cycles and saved one-time periods are managed together.</CardDescription></CardHeader><CardContent>{schedules.length ? <div className="divide-y rounded-md border">{schedules.map((schedule) => { const isOneTime = schedule.frequency === "once"; const completed = isOneTime && Boolean(schedule.lastRunAt); return <div key={schedule.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-gray-900">{schedule.name}</p><Badge variant={completed || !schedule.enabled ? "secondary" : "default"}>{completed ? "Prepared" : schedule.enabled ? "Active" : "Paused"}</Badge><Badge variant="outline">{isOneTime ? "One time" : "Monthly"}</Badge></div><p className="mt-1 text-xs text-gray-600">{isOneTime ? formatPeriod(schedule.periodStart, schedule.periodEnd) : "Previous calendar month"}</p><p className="mt-1 text-xs text-gray-500">{completed ? `Prepared ${new Date(schedule.lastRunAt).toLocaleString()}` : `Next preparation ${new Date(schedule.nextRunAt).toLocaleString()}`} · {schedule.requireApproval ? "Approval required" : `${schedule.cancellationWindowMinutes}-minute cancellation window`}</p></div><div className="flex gap-1">{!completed && <Button variant="outline" size="sm" onClick={() => action.mutate({ method:"POST", url:`/api/ultimate/schedules/${schedule.id}/run` })} disabled={action.isPending}><Play className="mr-2 h-3.5 w-3.5" />{isOneTime ? "Prepare early" : "Prepare now"}</Button>}{!completed && <Button variant="ghost" size="icon" aria-label={schedule.enabled ? "Pause schedule" : "Activate schedule"} onClick={() => action.mutate({ method:"PUT", url:`/api/ultimate/schedules/${schedule.id}`, data:{ enabled: !schedule.enabled } })}>{schedule.enabled ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}</Button>}<Button variant="ghost" size="icon" aria-label="Delete schedule" className="text-red-600" onClick={() => action.mutate({ method:"DELETE", url:`/api/ultimate/schedules/${schedule.id}` })}><Trash2 className="h-4 w-4" /></Button></div></div>; })}</div> : <p className="py-6 text-center text-sm text-gray-500">No schedules yet.</p>}</CardContent></Card>;
}

function ApprovalQueue({ jobs, onChanged }: { jobs: any[]; onChanged: () => void }) {
  const { toast } = useToast();
  const action = useMutation({ mutationFn: ({ url, data }: any) => apiRequest("POST", url, data), onSuccess: () => { onChanged(); toast({ title: "Invoice queue updated" }); }, onError: (error: Error) => toast({ title: "Invoice action failed", description: error.message, variant: "destructive" }) });
  return <Card><CardHeader><CardTitle className="text-lg">Approval queue and history</CardTitle><CardDescription>Prepared invoices stay visible after sending so every automated action can be traced.</CardDescription></CardHeader><CardContent>{jobs.length ? <div className="space-y-3">{jobs.map((job) => { const payload = job.payload || {}; const validation = job.validation || { errors:[], warnings:[] }; const cancellable = ["pending_approval","scheduled","needs_attention"].includes(job.status); return <div key={job.id} className="rounded-md border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-gray-900">{payload.client?.name || "Client invoice"}</p><span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusStyles[job.status] || statusStyles.cancelled}`}>{statusLabel(job.status)}</span></div><p className="mt-1 text-xs text-gray-500">{job.periodStart} to {job.periodEnd} · {payload.currency} {Number(payload.total || 0).toFixed(2)} · {payload.lineItems?.length || 0} items</p>{job.sendAt && job.status === "scheduled" && <p className="mt-1 text-xs font-medium text-blue-700">Sends {new Date(job.sendAt).toLocaleString()}</p>}</div><div className="flex flex-wrap gap-1">{job.status === "pending_approval" && <><Button size="sm" onClick={() => action.mutate({ url:`/api/ultimate/jobs/${job.id}/approve`, data:{ sendNow:false } })}><Check className="mr-2 h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => action.mutate({ url:`/api/ultimate/jobs/${job.id}/send-now`, data:{} })}><Send className="mr-2 h-3.5 w-3.5" />Send now</Button></>}{job.status === "failed" && <Button size="sm" variant="outline" onClick={() => action.mutate({ url:`/api/ultimate/jobs/${job.id}/retry`, data:{} })}><RefreshCcw className="mr-2 h-3.5 w-3.5" />Retry</Button>}{cancellable && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => action.mutate({ url:`/api/ultimate/jobs/${job.id}/cancel`, data:{} })}>Cancel</Button>}</div></div>{validation.errors?.length > 0 && <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-800">{validation.errors.join(" ")}</div>}{validation.warnings?.length > 0 && <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">{validation.warnings.join(" ")}</div>}{job.errorMessage && <p className="mt-3 text-xs text-red-700">{job.errorMessage}</p>}<div className="mt-3 grid gap-2 sm:grid-cols-2">{payload.lineItems?.slice(0,6).map((item:any) => <div key={item.key} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 truncate text-gray-600">{item.description}</span><span className="shrink-0 font-mono text-gray-900">{Number(item.hours).toFixed(2)}h · {payload.currency} {Number(item.amount).toFixed(2)}</span></div>)}</div></div>; })}</div> : <p className="py-6 text-center text-sm text-gray-500">Prepared invoices will appear here.</p>}</CardContent></Card>;
}
