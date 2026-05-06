import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Clock, Users, Calendar, TrendingUp } from "lucide-react";
import { TimeEntry, Client, Project, Settings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import { formatCurrency } from "@/lib/utils/timeUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function formatTimeFromDecimal(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  const seconds = Math.round(((decimalHours - hours) * 60 - minutes) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("decimal");
  const [displayCurrency, setDisplayCurrency] = useState<string>("USD");
  const today = new Date();
  const weekStart = format(startOfWeek(today), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const { data: allEntries = [] } = useQuery<TimeEntry[]>({ queryKey: ["/api/time-entries"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const updateCurrencyMutation = useMutation({
    mutationFn: (newCurrency: string) =>
      apiRequest("PUT", "/api/settings", { defaultCurrency: newCurrency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Currency updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update currency.", variant: "destructive" }),
  });

  useEffect(() => {
    if (settings) {
      if (settings.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      if (settings.defaultTimeFormat) setTimeFormat(settings.defaultTimeFormat as "decimal" | "time");
    }
  }, [settings]);

  const currentCurrency = (settings as any)?.defaultCurrency || displayCurrency;

  const weekEntries = allEntries.filter(e => e.date >= weekStart && e.date <= weekEnd);
  const monthEntries = allEntries.filter(e => e.date >= monthStart && e.date <= monthEnd);

  const weeklyHours = weekEntries.reduce((t, e) => t + Number(e.duration || 0), 0);
  const monthlyHours = monthEntries.reduce((t, e) => t + Number(e.duration || 0), 0);

  const conversionRates: Record<string, number> = {
    USD: 1.0, EUR: 0.92, GBP: 0.753, CAD: 1.35, RSD: 103.5,
  };

  const monthlyBillableAmount = monthEntries.reduce((total, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    if (project && entry.billable) {
      const client = clients.find(c => c.id === project.clientId);
      const projectCurrency = client?.currency || "USD";
      const amount = Number(entry.duration || 0) * Number(project.hourlyRate || 0);
      if (projectCurrency === currentCurrency) return total + amount;
      const inUSD = projectCurrency === "USD" ? amount : amount / (conversionRates[projectCurrency] || 1);
      const inDisplay = currentCurrency === "USD" ? inUSD : inUSD * (conversionRates[currentCurrency] || 1);
      return total + inDisplay;
    }
    return total;
  }, 0);

  const buildGroupedData = (entries: typeof allEntries, keyFn: (e: typeof allEntries[0]) => { id: number; name: string; color: string } | null) => {
    const acc: { id: number; name: string; hours: number; color: string }[] = [];
    entries.forEach(entry => {
      const key = keyFn(entry);
      if (!key) return;
      const existing = acc.find(i => i.id === key.id);
      if (existing) existing.hours += Number(entry.duration || 0);
      else acc.push({ ...key, hours: Number(entry.duration || 0) });
    });
    return acc.sort((a, b) => b.hours - a.hours);
  };

  const projectData = buildGroupedData(monthEntries, entry => {
    const p = projects.find(pr => pr.id === entry.projectId);
    if (!p) return { id: -1, name: "Unassigned", color: "#9CA3AF" };
    return { id: p.id, name: p.name, color: p.color || "#8884d8" };
  });

  const clientData = buildGroupedData(monthEntries, entry => {
    const p = projects.find(pr => pr.id === entry.projectId);
    if (!p) return { id: -1, name: "Unassigned", color: "#9CA3AF" };
    const c = clients.find(cl => cl.id === p.clientId);
    return { id: c?.id || -2, name: c?.name || "Unknown", color: p.color || "#8884d8" };
  });

  const dailyHoursData = (() => {
    const acc: { day: string; hours: number }[] = [];
    weekEntries.forEach(entry => {
      const day = format(new Date(entry.date), "EEE");
      const existing = acc.find(i => i.day === day);
      if (existing) existing.hours += Number(entry.duration || 0);
      else acc.push({ day, hours: Number(entry.duration || 0) });
    });
    const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return acc.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
  })();

  const fmtHours = (h: number) =>
    timeFormat === "decimal" ? `${h.toFixed(1)}h` : formatTimeFromDecimal(h);

  const StatCard = ({
    title, value, sub, icon: Icon, accent,
  }: {
    title: string; value: string; sub: string; icon: any; accent: string;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{title}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(today, "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">Format:</span>
          <Select value={timeFormat} onValueChange={(v: "decimal" | "time") => setTimeFormat(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
              <SelectItem value="time">Time (1:30:00)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Hours This Week"
          value={fmtHours(weeklyHours)}
          sub={`${format(new Date(weekStart), "MMM d")} – ${format(new Date(weekEnd), "MMM d")}`}
          icon={Clock}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Hours This Month"
          value={fmtHours(monthlyHours)}
          sub={format(new Date(monthStart), "MMMM yyyy")}
          icon={Calendar}
          accent="bg-violet-50 text-violet-600"
        />
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CurrencySelector
                selectedCurrency={currentCurrency}
                onCurrencyChange={c => updateCurrencyMutation.mutate(c)}
                className="text-xs"
                compact
              />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(monthlyBillableAmount, currentCurrency)}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Billable Amount</div>
            <div className="text-xs text-gray-400">{format(new Date(monthStart), "MMMM yyyy")}</div>
          </CardContent>
        </Card>
        <StatCard
          title="Active Clients"
          value={String(clients.length)}
          sub={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
          icon={Users}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Weekly Bar Chart — full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Activity</CardTitle>
          <p className="text-sm text-gray-500">Hours tracked per day this week</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyHoursData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v}h`}
                width={36}
              />
              <Tooltip
                formatter={(value) => [fmtHours(Number(value)), "Hours"]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="hours" fill="#6366f1" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie Charts — side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PieCard
          title="Time by Project"
          sub={`This month · ${format(new Date(monthStart), "MMMM yyyy")}`}
          data={projectData}
          fmtHours={fmtHours}
        />
        <PieCard
          title="Time by Client"
          sub={`This month · ${format(new Date(monthStart), "MMMM yyyy")}`}
          data={clientData}
          fmtHours={fmtHours}
        />
      </div>

      {/* Progress Breakdowns — side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title="Project Breakdown"
          sub="Hours by project this month"
          data={projectData}
          total={monthlyHours}
          fmtHours={fmtHours}
        />
        <BreakdownCard
          title="Client Breakdown"
          sub="Hours by client this month"
          data={clientData}
          total={monthlyHours}
          fmtHours={fmtHours}
        />
      </div>
    </div>
  );
}

function PieCard({
  title, sub, data, fmtHours,
}: {
  title: string; sub: string;
  data: { id: number; name: string; hours: number; color: string }[];
  fmtHours: (h: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-gray-500">{sub}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-gray-400">No data for this month</div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%" cy="50%"
                    innerRadius={32} outerRadius={62}
                    paddingAngle={2}
                    dataKey="hours"
                    strokeWidth={0}
                  >
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [fmtHours(Number(v)), "Hours"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {data.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-gray-500 font-medium flex-shrink-0">{fmtHours(item.hours)}</span>
                </div>
              ))}
              {data.length > 6 && (
                <p className="text-xs text-gray-400">+{data.length - 6} more</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title, sub, data, total, fmtHours,
}: {
  title: string; sub: string;
  data: { id: number; name: string; hours: number; color: string }[];
  total: number;
  fmtHours: (h: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-gray-500">{sub}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data for this month</div>
        ) : (
          <div className="space-y-4">
            {data.map(item => {
              const pct = total > 0 ? (item.hours / total) * 100 : 0;
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-gray-800 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-gray-500">
                      <span>{fmtHours(item.hours)}</span>
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
