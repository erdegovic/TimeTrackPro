import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfWeek,
  subDays,
  subYears,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Clock, FolderOpen, TrendingUp, Users } from "lucide-react";
import { TimeEntry, Client, Project, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import { formatCurrency } from "@/lib/utils/timeUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CustomCurrencyMap,
  convertCurrency,
  fetchCustomCurrencyRates,
  fetchExchangeRates,
  getExchangeRateSymbols,
  saveCustomCurrencyRates,
} from "@/lib/currency-rates";

type RangePreset = "week" | "last7" | "last30" | "last90" | "year" | "custom";
type DashboardRange = { start: Date; end: Date };
type TimeEntryWithRelations = TimeEntry & { client?: Client; project?: Project };
type GroupRow = {
  id: number;
  name: string;
  subtitle?: string;
  hours: number;
  amount: number;
  entries: number;
  color: string;
};

function formatTimeFromDecimal(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  const seconds = Math.round(((decimalHours - hours) * 60 - minutes) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function parseEntryDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getPresetRange(preset: RangePreset, today = new Date()): DashboardRange {
  if (preset === "week") {
    return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
  }
  if (preset === "last7") return { start: subDays(today, 6), end: today };
  if (preset === "last30") return { start: subDays(today, 29), end: today };
  if (preset === "last90") return { start: subDays(today, 89), end: today };
  if (preset === "year") return { start: subYears(today, 1), end: today };
  return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
}

/**
 * Measures an element's content width and keeps it in state. Used so the chart
 * can size itself against the *actual* content column (which is ~374px on a
 * phone, ~656px at 1024px and ~800px at 1440px because of the app shell) rather
 * than against a hard-coded desktop assumption.
 */
function useMeasuredWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, width] as const;
}

function getRangeLabel(range: DashboardRange) {
  const sameYear = format(range.start, "yyyy") === format(range.end, "yyyy");
  const start = format(range.start, sameYear ? "MMM d" : "MMM d, yyyy");
  const end = format(range.end, "MMM d, yyyy");
  return `${start} - ${end}`;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("decimal");
  const [displayCurrency, setDisplayCurrency] = useState<string>("USD");
  const [rangePreset, setRangePreset] = useState<RangePreset>("week");
  const [range, setRange] = useState<DashboardRange>(() => getPresetRange("week"));
  const [chartContainerRef, chartContainerWidth] = useMeasuredWidth<HTMLDivElement>();

  const { data: allEntries = [] } = useQuery<TimeEntryWithRelations[]>({ queryKey: ["/api/time-entries"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const { data: customCurrencyData } = useQuery({
    queryKey: ["/api/custom-currency-rates"],
    queryFn: fetchCustomCurrencyRates,
  });
  const customCurrencies = customCurrencyData?.currencies || {};

  const updateCurrencyMutation = useMutation({
    mutationFn: (newCurrency: string) => apiRequest("PUT", "/api/settings", { defaultCurrency: newCurrency }),
    onSuccess: async (response) => {
      const updatedSettings = await response.json();
      queryClient.setQueryData(["/api/settings"], updatedSettings);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Currency updated" });
    },
    onError: (error) => toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update currency.", variant: "destructive" }),
  });
  const saveCustomCurrenciesMutation = useMutation({
    mutationFn: (currencies: CustomCurrencyMap) => saveCustomCurrencyRates(currencies),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-currency-rates"] });
      toast({ title: "Currency rate saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save currency rate.", variant: "destructive" }),
  });

  useEffect(() => {
    if (settings) {
      if (settings.displayCurrency) setDisplayCurrency(settings.displayCurrency);
      if (settings.defaultTimeFormat) setTimeFormat(settings.defaultTimeFormat as "decimal" | "time");
    }
  }, [settings]);

  const currentCurrency = (settings as any)?.defaultCurrency || displayCurrency;

  const fmtHours = (hours: number) => (timeFormat === "decimal" ? `${hours.toFixed(1)}h` : formatTimeFromDecimal(hours));

  const enrichedEntries = useMemo(() => {
    return allEntries.map((entry) => {
      const project = entry.project || projects.find((item) => item.id === entry.projectId);
      const client = entry.client || clients.find((item) => item.id === (project?.clientId || entry.clientId));
      return { ...entry, project, client };
    });
  }, [allEntries, clients, projects]);

  const exchangeRateSymbols = useMemo(() => {
    return getExchangeRateSymbols([
      currentCurrency,
      ...enrichedEntries.map((entry) => entry.client?.currency),
    ]);
  }, [currentCurrency, enrichedEntries]);

  const { data: exchangeRatesData } = useQuery({
    queryKey: ["/api/exchange-rates", "USD", exchangeRateSymbols.join(",")],
    queryFn: () => fetchExchangeRates(exchangeRateSymbols, "USD"),
    enabled: exchangeRateSymbols.length > 0,
    staleTime: 60 * 60 * 1000,
  });
  const manualRateCurrencyCodes = exchangeRatesData
    ? exchangeRateSymbols.filter((currency) => !exchangeRatesData.rates[currency] && !customCurrencies[currency])
    : [];

  const filteredEntries = useMemo(() => {
    const startKey = toDateKey(range.start);
    const endKey = toDateKey(range.end);
    return enrichedEntries.filter((entry) => entry.date >= startKey && entry.date <= endKey);
  }, [enrichedEntries, range]);

  const dailyHoursData = useMemo(() => {
    const dayMap = new Map<string, { date: string; label: string; fullLabel: string; hours: number; amount: number; entries: number }>();
    eachDayOfInterval({ start: range.start, end: range.end }).forEach((date) => {
      const key = toDateKey(date);
      dayMap.set(key, {
        date: key,
        label: rangePreset === "week" ? format(date, "EEE") : format(date, "MMM d"),
        fullLabel: format(date, "EEEE, MMMM d, yyyy"),
        hours: 0,
        amount: 0,
        entries: 0,
      });
    });

    filteredEntries.forEach((entry) => {
      const day = dayMap.get(entry.date);
      if (!day) return;
      const hours = Number(entry.duration || 0);
      const rate = Number(entry.project?.hourlyRate || 0);
      const currency = entry.client?.currency || currentCurrency;
      day.hours += hours;
      day.amount += convertCurrency(hours * rate, currency, currentCurrency, exchangeRatesData?.rates, customCurrencies);
      day.entries += 1;
    });

    return Array.from(dayMap.values());
  }, [currentCurrency, customCurrencies, exchangeRatesData?.rates, filteredEntries, range, rangePreset]);

  const rangeHours = filteredEntries.reduce((total, entry) => total + Number(entry.duration || 0), 0);
  const activeDays = dailyHoursData.filter((day) => day.hours > 0).length;
  const averagePerActiveDay = activeDays > 0 ? rangeHours / activeDays : 0;
  const averagePerCalendarDay = dailyHoursData.length > 0 ? rangeHours / dailyHoursData.length : 0;
  const billableAmount = dailyHoursData.reduce((total, day) => total + day.amount, 0);

  const buildGroupedData = (mode: "client" | "project"): GroupRow[] => {
    const rows = new Map<number, GroupRow>();

    filteredEntries.forEach((entry) => {
      const project = entry.project;
      const client = entry.client;
      const isProject = mode === "project";
      const id = isProject ? project?.id ?? -1 : client?.id ?? -1;
      const name = isProject ? project?.name || "Unassigned Project" : client?.name || "Unassigned Client";
      const subtitle = isProject ? client?.name || "No client" : `${project?.name || "No project"} activity`;
      const color = isProject ? project?.color || "#6366f1" : client?.color || "#2563eb";
      const hours = Number(entry.duration || 0);
      const rate = Number(project?.hourlyRate || 0);
      const currency = client?.currency || currentCurrency;
      const amount = convertCurrency(hours * rate, currency, currentCurrency, exchangeRatesData?.rates, customCurrencies);
      const existing = rows.get(id);

      if (existing) {
        existing.hours += hours;
        existing.amount += amount;
        existing.entries += 1;
      } else {
        rows.set(id, { id, name, subtitle, hours, amount, entries: 1, color });
      }
    });

    return Array.from(rows.values()).sort((a, b) => b.hours - a.hours);
  };

  const projectData = buildGroupedData("project");
  const clientData = buildGroupedData("client");
  const topProject = projectData[0];
  const topClient = clientData[0];

  // The chart used to demand a hard 760px minimum for any range longer than a
  // week. On a phone (a ~374px content column) that turned "Daily Work Pattern"
  // into a horizontally scrolling region nested inside the vertically scrolling
  // page — a gesture-conflict trap. The per-column width and the minimum are
  // now derived from the measured container, so a 30-day range fits outright on
  // a phone and longer ranges scroll far less; the x-axis also thins its ticks
  // on narrow viewports so the labels stay legible.
  const isNarrowChart = chartContainerWidth > 0 && chartContainerWidth < 640;
  const dayCount = dailyHoursData.length;
  const perColumnWidth = isNarrowChart
    ? dayCount > 180
      ? 6
      : dayCount > 90
        ? 8
        : dayCount > 45
          ? 10
          : 12
    : dayCount > 180
      ? 9
      : dayCount > 90
        ? 12
        : dayCount > 45
          ? 16
          : 28;
  const minChartWidth = isNarrowChart ? chartContainerWidth : 760;
  const chartWidth = dayCount <= 7 ? "100%" : Math.max(minChartWidth, dayCount * perColumnWidth);
  const xAxisInterval = isNarrowChart
    ? dayCount > 180
      ? 44
      : dayCount > 95
        ? 20
        : dayCount > 45
          ? 10
          : dayCount > 20
            ? 6
            : dayCount > 10
              ? 2
              : 0
    : dayCount > 180
      ? 29
      : dayCount > 95
        ? 13
        : dayCount > 45
          ? 6
          : dayCount > 20
            ? 2
            : 0;
  const barCategoryGap =
    dailyHoursData.length <= 7 ? "18%" : dailyHoursData.length > 90 ? "6%" : dailyHoursData.length > 45 ? "10%" : "14%";
  const maxBarSize =
    dailyHoursData.length <= 7 ? 86 : dailyHoursData.length > 180 ? 8 : dailyHoursData.length > 90 ? 10 : dailyHoursData.length > 45 ? 14 : 24;
  const daysInRange = differenceInCalendarDays(range.end, range.start) + 1;

  const handlePresetChange = (preset: RangePreset) => {
    setRangePreset(preset);
    if (preset !== "custom") setRange(getPresetRange(preset));
  };

  const handleCurrencyChange = (currency: string) => {
    updateCurrencyMutation.mutate(currency);
  };

  const handleSaveCustomCurrencies = async (currencies: CustomCurrencyMap) => {
    await saveCustomCurrenciesMutation.mutateAsync(currencies);
  };

  const setCustomStart = (date?: Date) => {
    if (!date) return;
    setRangePreset("custom");
    setRange((current) => ({ start: date, end: date > current.end ? date : current.end }));
  };

  const setCustomEnd = (date?: Date) => {
    if (!date) return;
    setRangePreset("custom");
    setRange((current) => ({ start: date < current.start ? date : current.start, end: date }));
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{getRangeLabel(range)} · {daysInRange} day{daysInRange === 1 ? "" : "s"}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={rangePreset} onValueChange={(value: RangePreset) => handlePresetChange(value)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="last7">Last 7 days</SelectItem>
              <SelectItem value="last30">Last 30 days</SelectItem>
              <SelectItem value="last90">Last 90 days</SelectItem>
              <SelectItem value="year">Last 1 year</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {rangePreset === "custom" && (
            <DateRangeControls range={range} onStartChange={setCustomStart} onEndChange={setCustomEnd} />
          )}

          <Select value={timeFormat} onValueChange={(value: "decimal" | "time") => setTimeFormat(value)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="decimal">Decimal time</SelectItem>
              <SelectItem value="time">Clock time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard title="Tracked Hours" value={fmtHours(rangeHours)} sub={getRangeLabel(range)} icon={Clock} accent="bg-blue-50 text-blue-600" />
        <StatCard title="Active Days" value={`${activeDays}/${dailyHoursData.length}`} sub={`${fmtHours(averagePerCalendarDay)} daily average`} icon={CalendarDays} accent="bg-violet-50 text-violet-600" />
        <StatCard title="Best Project" value={topProject?.name || "None"} sub={topProject ? fmtHours(topProject.hours) : "No tracked work"} icon={FolderOpen} accent="bg-amber-50 text-amber-600" />
        <StatCard title="Best Client" value={topClient?.name || "None"} sub={topClient ? fmtHours(topClient.hours) : "No client activity"} icon={Users} accent="bg-teal-50 text-teal-600" />
        <Card className="relative z-20 col-span-2 overflow-visible lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CurrencySelector
                selectedCurrency={currentCurrency}
                onCurrencyChange={handleCurrencyChange}
                customCurrencies={customCurrencies}
                manualRateCurrencyCodes={manualRateCurrencyCodes}
                onSaveCustomCurrencies={handleSaveCustomCurrencies}
                className="text-xs"
                compact
              />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(billableAmount, currentCurrency)}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Estimated Value</div>
            <div className="text-xs text-gray-400">{fmtHours(averagePerActiveDay)} per active day</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Daily Work Pattern</CardTitle>
              <p className="text-sm text-gray-500">Every day in the selected range is shown, including days with zero hours.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BarChart3 className="h-4 w-4" />
              {dailyHoursData.length} columns
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={chartContainerRef} className="overflow-x-auto pb-2">
            <div style={{ width: chartWidth, height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyHoursData} margin={{ top: 12, right: 20, bottom: 8, left: 0 }} barCategoryGap={barCategoryGap}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                  <XAxis
                    dataKey="label"
                    interval={xAxisInterval}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} width={36} />
                  <Tooltip content={<DailyTooltip fmtHours={fmtHours} currency={currentCurrency} />} cursor={{ fill: "rgba(15, 23, 42, 0.05)" }} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={maxBarSize}>
                    {dailyHoursData.map((day) => (
                      <Cell key={day.date} fill={day.hours > 0 ? "#2563eb" : "#dbeafe"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PieCard title="Time by Client" sub={getRangeLabel(range)} data={clientData} fmtHours={fmtHours} />
        <PieCard title="Time by Project" sub={getRangeLabel(range)} data={projectData} fmtHours={fmtHours} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BreakdownCard title="Client Overview" sub="Hours, estimated value, and entry count" data={clientData} total={rangeHours} fmtHours={fmtHours} currency={currentCurrency} />
        <BreakdownCard title="Project Overview" sub="Detailed split by project and client" data={projectData} total={rangeHours} fmtHours={fmtHours} currency={currentCurrency} />
      </div>
    </div>
  );
}

function DateRangeControls({
  range,
  onStartChange,
  onEndChange,
}: {
  range: DashboardRange;
  onStartChange: (date?: Date) => void;
  onEndChange: (date?: Date) => void;
}) {
  return (
    // Two side-by-side buttons each rendering "MMM d, yyyy" clipped their label
    // at 320px, so the pair only splits into columns once there is room for it.
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:w-[280px]">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start truncate px-3 text-left font-normal">
            {format(range.start, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarComponent mode="single" selected={range.start} onSelect={onStartChange} initialFocus />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start truncate px-3 text-left font-normal">
            {format(range.end, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarComponent mode="single" selected={range.end} onSelect={onEndChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DailyTooltip({ active, payload, fmtHours, currency }: any) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-md border bg-white p-3 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{day.fullLabel}</div>
      <div className="mt-1 text-xs text-gray-500">{day.entries} entr{day.entries === 1 ? "y" : "ies"}</div>
      <div className="mt-2 text-sm text-gray-700">{fmtHours(Number(day.hours || 0))}</div>
      <div className="text-sm text-gray-700">{formatCurrency(Number(day.amount || 0), currency)}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  icon: any;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className={`mb-3 inline-flex rounded-lg p-2 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="truncate text-2xl font-bold text-gray-900" title={value}>{value}</div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
        <div className="mt-0.5 truncate text-xs text-gray-400" title={sub}>{sub}</div>
      </CardContent>
    </Card>
  );
}

function PieCard({
  title,
  sub,
  data,
  fmtHours,
}: {
  title: string;
  sub: string;
  data: GroupRow[];
  fmtHours: (hours: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-gray-500">{sub}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-sm text-gray-400">No tracked work in this range</div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-40 w-full flex-shrink-0 sm:w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={70} paddingAngle={2} dataKey="hours" strokeWidth={0}>
                    {data.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [fmtHours(Number(value)), "Hours"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {data.slice(0, 7).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate text-gray-700">{item.name}</span>
                  </div>
                  <span className="flex-shrink-0 font-medium text-gray-500">{fmtHours(item.hours)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  sub,
  data,
  total,
  fmtHours,
  currency,
}: {
  title: string;
  sub: string;
  data: GroupRow[];
  total: number;
  fmtHours: (hours: number) => string;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-gray-500">{sub}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">No tracked work in this range</div>
        ) : (
          <div className="space-y-4">
            {data.map((item) => {
              const pct = total > 0 ? (item.hours / total) * 100 : 0;
              return (
                <div key={item.id} className="rounded-md border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <div className="truncate font-medium text-gray-900">{item.name}</div>
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500">{item.subtitle}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{fmtHours(item.hours)}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.amount, currency)}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-400">
                    <span>{item.entries} entr{item.entries === 1 ? "y" : "ies"}</span>
                    <span>{pct.toFixed(0)}%</span>
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
