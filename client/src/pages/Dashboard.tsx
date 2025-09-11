import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Clock, CreditCard, DollarSign, Users, Calendar, Activity } from "lucide-react";
import { TimeEntry, Client, Project, Settings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySelector } from "@/components/ui/CurrencySelector";
import { formatCurrency } from "@/lib/utils/timeUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Helper function to format decimal hours to HH:MM:SS
function formatTimeFromDecimal(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.floor((decimalHours - hours) * 60);
  const seconds = Math.round(((decimalHours - hours) * 60 - minutes) * 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function Dashboard() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [timeFormat, setTimeFormat] = useState<"decimal" | "time">("decimal");
  const [displayCurrency, setDisplayCurrency] = useState<string>("USD");
  const today = new Date();
  const weekStart = format(startOfWeek(today), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  // Fetch all time entries first, then filter client-side for now
  const { data: allEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries"],
  });

  // Filter entries for this week on the client side
  const weekEntries = allEntries.filter(entry => {
    const entryDate = entry.date;
    return entryDate >= weekStart && entryDate <= weekEnd;
  });

  // Filter entries for this month on the client side
  const monthEntries = allEntries.filter(entry => {
    const entryDate = entry.date;
    return entryDate >= monthStart && entryDate <= monthEnd;
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  
  // Fetch settings for display currency
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Currency update mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: (newCurrency: string) => 
      apiRequest("PUT", "/api/settings", { defaultCurrency: newCurrency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Currency updated",
        description: "Default currency has been changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update currency.",
        variant: "destructive",
      });
    },
  });

  const handleCurrencyChange = (newCurrency: string) => {
    updateCurrencyMutation.mutate(newCurrency);
  };
  
  // Update state when settings are loaded
  useEffect(() => {
    if (settings) {
      if (settings.displayCurrency) {
        setDisplayCurrency(settings.displayCurrency);
      }
      if (settings.defaultTimeFormat) {
        setTimeFormat(settings.defaultTimeFormat as "decimal" | "time");
      }
    }
  }, [settings]);

  // Use settings currency directly, fallback to state
  const currentCurrency = (settings as any)?.defaultCurrency || displayCurrency;

  // Calculate total hours for this week - ALWAYS use duration field for edited entries
  const weeklyHours = weekEntries.reduce((total, entry) => {
    // Always prioritize the stored duration value, which contains any edits
    // This ensures consistency with the time tracker view
    return total + Number(entry.duration || 0);
  }, 0);

  // Calculate total hours for this month - ALWAYS use duration field for edited entries
  const monthlyHours = monthEntries.reduce((total, entry) => {
    // Always prioritize the stored duration value, which contains any edits
    // This ensures consistency with the time tracker view
    return total + Number(entry.duration || 0);
  }, 0);

  // Calculate billable amount for this month
  const monthlyBillableAmount = monthEntries.reduce((total, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    if (project && entry.billable) {
      // Find the client to use their currency if available
      const client = clients.find(c => c.id === project.clientId);
      const projectCurrency = client?.currency || 'USD';
      
      // Current accurate market rates (USD as base - May 2025)
      const conversionRates: {[key: string]: number} = {
        'USD': 1.0,
        'EUR': 0.92,  // 1 USD = 0.92 EUR
        'GBP': 0.753, // 1 USD = 0.753 GBP (matching 12.8 USD = 9.64 GBP)
        'CAD': 1.35,  // 1 USD = 1.35 CAD
        'RSD': 103.5  // 1 USD = 103.5 RSD
      };
      
      // Calculate the amount in the project's currency
      const amount = Number(entry.duration || 0) * Number(project.hourlyRate || 0);
      
      // If the currencies are the same, no conversion needed
      if (projectCurrency === currentCurrency) {
        return total + amount;
      }
      
      // Convert directly between currencies using the most accurate method
      // First to USD (as base currency)
      const amountInUSD = projectCurrency === 'USD' ? amount : amount / conversionRates[projectCurrency];
      // Then from USD to display currency
      const inDisplayCurrency = currentCurrency === 'USD' ? amountInUSD : amountInUSD * conversionRates[currentCurrency];
      
      return total + inDisplayCurrency;
    }
    return total;
  }, 0);

  // Group by projects for pie chart with colors, including unassigned entries
  const projectData = monthEntries.reduce((acc, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    
    if (!project) {
      // Handle unassigned entries
      const existingUnassigned = acc.find(item => item.id === -1);
      if (existingUnassigned) {
        existingUnassigned.hours += Number(entry.duration || 0);
      } else {
        acc.push({
          id: -1,
          name: 'Unassigned',
          hours: Number(entry.duration || 0),
          color: '#9CA3AF', // Gray color for unassigned
        });
      }
    } else {
      const existingProject = acc.find(item => item.id === project.id);
      if (existingProject) {
        existingProject.hours += Number(entry.duration || 0);
      } else {
        acc.push({
          id: project.id,
          name: project.name,
          hours: Number(entry.duration || 0),
          color: project.color || '#8884d8',
        });
      }
    }
    return acc;
  }, [] as { id: number; name: string; hours: number; color: string }[]);

  // Sort project data by hours (descending) for better visualization
  projectData.sort((a, b) => b.hours - a.hours);

  // Group by clients for client breakdown chart
  const clientData = monthEntries.reduce((acc, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    
    if (!project) {
      // Handle unassigned entries
      const existingUnassigned = acc.find(item => item.id === -1);
      if (existingUnassigned) {
        existingUnassigned.hours += Number(entry.duration || 0);
      } else {
        acc.push({
          id: -1,
          name: 'Unassigned',
          hours: Number(entry.duration || 0),
          color: '#9CA3AF', // Gray color for unassigned
        });
      }
    } else {
      const client = clients.find(c => c.id === project.clientId);
      const clientName = client?.name || 'Unknown Client';
      const clientColor = project.color || '#8884d8'; // Use project color for client
      
      const existingClient = acc.find(item => item.name === clientName);
      if (existingClient) {
        existingClient.hours += Number(entry.duration || 0);
      } else {
        acc.push({
          id: client?.id || -2,
          name: clientName,
          hours: Number(entry.duration || 0),
          color: clientColor,
        });
      }
    }
    return acc;
  }, [] as { id: number; name: string; hours: number; color: string }[]);

  // Sort client data by hours (descending) for better visualization
  clientData.sort((a, b) => b.hours - a.hours);

  // Daily hours for bar chart with project breakdown
  const dailyHoursData = weekEntries.reduce((acc, entry) => {
    const day = format(new Date(entry.date), "EEE");
    const project = projects.find(p => p.id === entry.projectId);
    const projectName = project?.name || 'Unknown Project';
    const projectColor = project?.color || '#8884d8';
    
    const existingDay = acc.find(item => item.day === day);
    
    if (existingDay) {
      const existingProject = existingDay.projects.find(p => p.name === projectName);
      if (existingProject) {
        existingProject.hours += Number(entry.duration || 0);
      } else {
        existingDay.projects.push({
          name: projectName,
          hours: Number(entry.duration || 0),
          color: projectColor,
        });
      }
      existingDay.hours += Number(entry.duration || 0);
    } else {
      acc.push({
        day,
        hours: Number(entry.duration || 0),
        projects: [{
          name: projectName,
          hours: Number(entry.duration || 0),
          color: projectColor,
        }],
      });
    }
    return acc;
  }, [] as { day: string; hours: number; projects: { name: string; hours: number; color: string }[] }[]);

  // Sort dailyHoursData by day of week
  const daysOfWeekOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dailyHoursData.sort((a, b) => {
    return daysOfWeekOrder.indexOf(a.day) - daysOfWeekOrder.indexOf(b.day);
  });

  // Colors for charts
  const COLORS = ["#00a5e4", "#dc3545", "#fd7e14", "#9333ea", "#28a745"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center space-x-2 flex-wrap">
            <label htmlFor="time-format" className="text-sm font-medium text-gray-500 whitespace-nowrap">Format:</label>
            <Select value={timeFormat} onValueChange={(val: "decimal" | "time") => setTimeFormat(val)}>
              <SelectTrigger id="time-format" className="w-[130px] max-w-full">
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
            <CurrencySelector
              selectedCurrency={currentCurrency}
              onCurrencyChange={handleCurrencyChange}
              className="text-xs"
              compact={true}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyBillableAmount.toFixed(2)}</div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <Card className="md:col-span-2 lg:col-span-6">
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Your time tracking activity for this week</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
              <BarChart data={dailyHoursData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="day" 
                  fontSize={12}
                  className="sm:text-sm"
                />
                <YAxis 
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  fontSize={12}
                  className="sm:text-sm"
                />
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

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Time by Project</CardTitle>
            <CardDescription className="text-sm">Distribution of hours across projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] mb-3">
                {projectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="hours"
                        nameKey="name"
                        label={false}
                      >
                        {projectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
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
                  <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                    No project data available
                  </div>
                )}
              </div>
              
              {/* Legend */}
              {projectData.length > 0 && (
                <div className="w-full space-y-1 max-h-20 sm:max-h-24 overflow-y-auto">
                  {projectData.slice(0, 4).map((project) => (
                    <div key={project.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="text-gray-700 truncate">{project.name}</span>
                      </div>
                      <span className="text-gray-500 font-medium ml-2 flex-shrink-0">
                        {timeFormat === "decimal" 
                          ? `${project.hours.toFixed(1)}h` 
                          : formatTimeFromDecimal(project.hours)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Time by Client</CardTitle>
            <CardDescription className="text-sm">Distribution of hours across clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] mb-3">
                {clientData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clientData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="hours"
                        nameKey="name"
                        label={false}
                      >
                        {clientData.map((entry, index) => (
                          <Cell key={`client-${index}`} fill={entry.color} />
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
                  <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                    No client data available
                  </div>
                )}
              </div>
              
              {/* Legend */}
              {clientData.length > 0 && (
                <div className="w-full space-y-1 max-h-20 sm:max-h-24 overflow-y-auto">
                  {clientData.slice(0, 4).map((client) => (
                    <div key={client.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: client.color }}
                        />
                        <span className="text-gray-700 truncate">{client.name}</span>
                      </div>
                      <span className="text-gray-500 font-medium ml-2 flex-shrink-0">
                        {timeFormat === "decimal" 
                          ? `${client.hours.toFixed(1)}h` 
                          : formatTimeFromDecimal(client.hours)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Hours Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Hours</CardTitle>
            <CardDescription>Time breakdown by project this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projectData.length > 0 ? (
                projectData.map((project, index) => {
                  const percentage = (project.hours / monthlyHours) * 100;
                  return (
                    <div key={project.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium truncate">{project.name}</span>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 text-gray-600 flex-shrink-0">
                          <span className="text-xs sm:text-sm">
                            {timeFormat === "decimal" 
                              ? `${project.hours.toFixed(1)}h` 
                              : formatTimeFromDecimal(project.hours)}
                          </span>
                          <span className="text-xs">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: project.color 
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  No project data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Hours</CardTitle>
            <CardDescription>Time breakdown by client this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientData.length > 0 ? (
                clientData.map((client, index) => {
                  const percentage = (client.hours / monthlyHours) * 100;
                  return (
                    <div key={client.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: client.color }}
                          />
                          <span className="font-medium truncate">{client.name}</span>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 text-gray-600 flex-shrink-0">
                          <span className="text-xs sm:text-sm">
                            {timeFormat === "decimal" 
                              ? `${client.hours.toFixed(1)}h` 
                              : formatTimeFromDecimal(client.hours)}
                          </span>
                          <span className="text-xs">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300" 
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: client.color 
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  No client data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
