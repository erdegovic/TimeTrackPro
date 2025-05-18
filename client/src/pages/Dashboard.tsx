import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Clock, CreditCard, DollarSign, Users, Calendar, Activity } from "lucide-react";
import { TimeEntry, Client, Project } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to format decimal hours to HH:MM:SS
function formatTimeFromDecimal(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  const seconds = Math.round(((decimalHours - hours) * 60 - minutes) * 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function Dashboard() {
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("decimal");
  const today = new Date();
  const weekStart = format(startOfWeek(today), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  // Fetch time entries for this week
  const { data: weekEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", "week"],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?startDate=${weekStart}&endDate=${weekEnd}`);
      if (!res.ok) throw new Error("Failed to fetch weekly time entries");
      return res.json();
    },
  });

  // Fetch time entries for this month
  const { data: monthEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", "month"],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?startDate=${monthStart}&endDate=${monthEnd}`);
      if (!res.ok) throw new Error("Failed to fetch monthly time entries");
      return res.json();
    },
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Calculate total hours for this week
  const weeklyHours = weekEntries.reduce((total, entry) => {
    return total + Number(entry.duration || 0);
  }, 0);

  // Calculate total hours for this month
  const monthlyHours = monthEntries.reduce((total, entry) => {
    return total + Number(entry.duration || 0);
  }, 0);

  // Calculate billable amount for this month
  const monthlyBillableAmount = monthEntries.reduce((total, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    if (project && entry.billable) {
      return total + (Number(entry.duration || 0) * Number(project.hourlyRate || 0));
    }
    return total;
  }, 0);

  // Group by projects for pie chart
  const projectData = monthEntries.reduce((acc, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    if (!project) return acc;

    const existingProject = acc.find(item => item.id === project.id);
    if (existingProject) {
      existingProject.hours += Number(entry.duration || 0);
    } else {
      acc.push({
        id: project.id,
        name: project.name,
        hours: Number(entry.duration || 0),
      });
    }
    return acc;
  }, [] as { id: number; name: string; hours: number }[]);

  // Daily hours for bar chart
  const dailyHoursData = weekEntries.reduce((acc, entry) => {
    const day = format(new Date(entry.date), "EEE");
    const existingDay = acc.find(item => item.day === day);
    
    if (existingDay) {
      existingDay.hours += Number(entry.duration || 0);
    } else {
      acc.push({
        day,
        hours: Number(entry.duration || 0),
      });
    }
    return acc;
  }, [] as { day: string; hours: number }[]);

  // Sort dailyHoursData by day of week
  const daysOfWeekOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dailyHoursData.sort((a, b) => {
    return daysOfWeekOrder.indexOf(a.day) - daysOfWeekOrder.indexOf(b.day);
  });

  // Colors for charts
  const COLORS = ["#00a5e4", "#dc3545", "#fd7e14", "#9333ea", "#28a745"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="time-format" className="text-sm font-medium text-gray-500">Format:</label>
            <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
              <SelectTrigger id="time-format" className="w-[130px]">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
                <SelectItem value="time">Time (1:30:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-gray-500">
            {format(today, "MMMM d, yyyy")}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeFormat === "decimal" 
                ? `${weeklyHours.toFixed(1)}h` 
                : formatTimeFromDecimal(weeklyHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {format(new Date(weekStart), "MMM d")} to {format(new Date(weekEnd), "MMM d")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeFormat === "decimal" 
                ? `${monthlyHours.toFixed(1)}h` 
                : formatTimeFromDecimal(monthlyHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(monthStart), "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyBillableAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For {format(new Date(monthStart), "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">
              Total: {projects.length} Projects
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Your time tracking activity for this week</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyHoursData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  formatter={(value) => {
                    const numValue = Number(value);
                    return [
                      timeFormat === "decimal" 
                        ? `${numValue.toFixed(1)} hours` 
                        : formatTimeFromDecimal(numValue),
                      'Time'
                    ];
                  }}
                  labelFormatter={(label) => `${label}`} 
                />
                <Bar dataKey="hours" fill="#00a5e4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Time by Project</CardTitle>
            <CardDescription>Distribution of hours across projects</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-[300px] w-[300px]">
              {projectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="hours"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {projectData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => {
                      const numValue = Number(value);
                      return [
                        timeFormat === "decimal" 
                          ? `${numValue.toFixed(1)} hours` 
                          : formatTimeFromDecimal(numValue),
                        'Time'
                      ];
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-500">
                  No project data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
