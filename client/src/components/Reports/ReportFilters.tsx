import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw } from "lucide-react";
import { ReportFilters, Client, Project, TimeFormat, RoundingType } from "@shared/schema";
import { getCompleteReportMonthRange, type ReportDatePreset } from "@shared/report-periods";

interface ReportFiltersProps {
  onApplyFilters: (filters: ReportFilters) => void;
  liveUpdate?: boolean;
}

const defaultDateRange = () => getCompleteReportMonthRange(1);

export default function ReportFiltersComponent({ onApplyFilters, liveUpdate = false }: ReportFiltersProps) {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("previous_month");
  const [filters, setFilters] = useState<ReportFilters>({
    clientId: undefined,
    projectId: undefined,
    ...defaultDateRange(),
    timeFormat: "decimal",
    roundingType: "none",
    timeAdjustment: {
      increaseByPercentage: false,
      percentage: 10,
      roundToNearestTenth: false
    }
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", filters.clientId],
    queryFn: async () => {
      if (!filters.clientId) return [];
      const res = await fetch(`/api/projects?clientId=${filters.clientId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!filters.clientId,
  });

  // Filtered projects for the selected client
  const clientProjects = filters.clientId 
    ? projects.filter(project => project.clientId === filters.clientId)
    : [];

  const updateFilters = (nextFilters: ReportFilters, shouldLiveUpdate = false) => {
    setFilters(nextFilters);
    if (liveUpdate && shouldLiveUpdate) {
      onApplyFilters(nextFilters);
    }
  };

  const handleReset = () => {
    setDatePreset("previous_month");
    const resetFilters: ReportFilters = {
      clientId: undefined,
      projectId: undefined,
      ...defaultDateRange(),
      timeFormat: "decimal",
      roundingType: "none",
      timeAdjustment: {
        increaseByPercentage: false,
        percentage: 10,
        roundToNearestTenth: false
      }
    };
    updateFilters(resetFilters, true);
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <Select 
            value={filters.clientId?.toString()} 
            onValueChange={(val) => {
              const clientId = val === "all" ? undefined : Number(val);
              updateFilters({
                ...filters,
                clientId,
                projectId: undefined // Reset project when client changes
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <Select 
            value={filters.projectId?.toString()} 
            onValueChange={(val) => {
              const projectId = val === "all" ? undefined : Number(val);
              updateFilters({
                ...filters,
                projectId
              });
            }}
            disabled={!filters.clientId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {clientProjects.map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="col-span-1 sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
          <Select
            value={datePreset}
            onValueChange={(value: ReportDatePreset) => {
              setDatePreset(value);
              if (value === "custom") return;
              const monthCount = value === "last_3_months" ? 3 : value === "last_6_months" ? 6 : value === "last_12_months" ? 12 : 1;
              updateFilters({ ...filters, ...getCompleteReportMonthRange(monthCount) }, true);
            }}
          >
            <SelectTrigger aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous_month">Previous month</SelectItem>
              <SelectItem value="last_3_months">Last 3 complete months</SelectItem>
              <SelectItem value="last_6_months">Last 6 complete months</SelectItem>
              <SelectItem value="last_12_months">Last 12 complete months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === "custom" && (
            <div className="mt-2 grid grid-cols-1 items-center gap-2 min-[400px]:grid-cols-[1fr_auto_1fr]">
              <Input
                type="date"
                aria-label="Report start date"
                value={filters.startDate}
                max={filters.endDate}
                onChange={(e) => updateFilters({ ...filters, startDate: e.target.value })}
                className="w-full min-w-0"
              />
              <span aria-hidden="true" className="hidden px-1 text-sm text-gray-400 min-[400px]:inline">to</span>
              <Input
                type="date"
                aria-label="Report end date"
                value={filters.endDate}
                min={filters.startDate}
                onChange={(e) => updateFilters({ ...filters, endDate: e.target.value })}
                className="w-full min-w-0"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Button onClick={handleApplyFilters} className="w-full sm:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>
          <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Select 
            value={filters.timeFormat} 
            onValueChange={(val: TimeFormat) => updateFilters({ ...filters, timeFormat: val }, true)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Time format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="decimal">Decimal (1.5h)</SelectItem>
              <SelectItem value="time">Time (1:30)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={filters.roundingType} 
            onValueChange={(val: RoundingType) => updateFilters({ ...filters, roundingType: val }, true)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Rounding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No rounding</SelectItem>
              <SelectItem value="nearest_tenth">Round up to next 0.1</SelectItem>
              <SelectItem value="nearest_quarter">Round to nearest 0.25</SelectItem>
              <SelectItem value="nearest_half">Round to nearest 0.5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Time adjustment section */}
      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Time Adjustments</h3>
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start lg:items-center">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="adjustment-percentage" 
              checked={filters.timeAdjustment?.increaseByPercentage}
              onCheckedChange={(checked) => 
                updateFilters({
                  ...filters,
                  timeAdjustment: {
                    ...filters.timeAdjustment!,
                    increaseByPercentage: !!checked
                  }
                }, true)
              }
            />
            <label htmlFor="adjustment-percentage" className="text-sm text-gray-700">Increase by percentage</label>
          </div>
          
          <div className="relative w-20 sm:w-24">
            <Input
              type="number"
              value={filters.timeAdjustment?.percentage || 10}
              min="0"
              max="100"
              onChange={(e) => 
                updateFilters({
                  ...filters,
                  timeAdjustment: {
                    ...filters.timeAdjustment!,
                    percentage: parseInt(e.target.value) || 0
                  }
                }, true)
              }
              className="pr-6"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <span className="text-gray-500 sm:text-sm">%</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-0 lg:ml-4">
            <Checkbox 
              id="round-tenths" 
              checked={filters.timeAdjustment?.roundToNearestTenth}
              onCheckedChange={(checked) => 
                updateFilters({
                  ...filters,
                  timeAdjustment: {
                    ...filters.timeAdjustment!,
                    roundToNearestTenth: !!checked
                  }
                }, true)
              }
            />
            <label htmlFor="round-tenths" className="text-sm text-gray-700">Round up to next tenth</label>
          </div>

          {liveUpdate && (
            <p className="text-xs text-gray-500 mt-2 lg:mt-0">
              Preview updates automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
