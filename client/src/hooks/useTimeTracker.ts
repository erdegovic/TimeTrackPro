import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TimeEntry } from "@shared/schema";
import { calculateDuration } from "@/lib/utils/timeUtils";
import { format } from "date-fns";

export function useTimeTracker() {
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [description, setDescription] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  
  // Timer interval ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Create time entry mutation
  const createTimeEntry = useMutation({
    mutationFn: async (timeEntry: Partial<TimeEntry>) => {
      return apiRequest("POST", "/api/time-entries", timeEntry);
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      toast({
        title: "Time entry saved",
        description: "Your time entry has been saved successfully.",
      });
      
      // Reset form
      setDescription("");
      setElapsedTime(0);
    },
    onError: (error) => {
      console.error("Failed to save time entry:", error);
      toast({
        title: "Error",
        description: "Failed to save time entry. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Load in-progress timer from localStorage on mount
  useEffect(() => {
    const storedTimer = localStorage.getItem("timeTracker");
    if (storedTimer) {
      try {
        const { startTime, description, clientId, projectId } = JSON.parse(storedTimer);
        if (startTime) {
          setStartTime(startTime);
          setIsTracking(true);
          setDescription(description || "");
          setSelectedClientId(clientId);
          setSelectedProjectId(projectId);
        }
      } catch (error) {
        console.error("Error parsing stored timer:", error);
      }
    }
  }, []);
  
  // Update elapsed time when tracking
  useEffect(() => {
    console.log("Timer effect running, isTracking:", isTracking, "startTime:", startTime);
    
    // Clear any existing interval first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (isTracking && startTime) {
      // Initial calculation
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      // Set up timer to update every second
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      console.log("Timer interval set:", timerRef.current);
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        console.log("Cleanup: clearing timer interval");
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTracking, startTime]);
  
  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (isTracking && startTime) {
      localStorage.setItem("timeTracker", JSON.stringify({
        startTime,
        description,
        clientId: selectedClientId,
        projectId: selectedProjectId
      }));
    } else {
      localStorage.removeItem("timeTracker");
    }
  }, [isTracking, startTime, description, selectedClientId, selectedProjectId]);
  
  // Start the timer
  const startTimer = () => {
    console.log("Starting timer...", { description, selectedProjectId });
    
    if (!description || !selectedProjectId) {
      toast({
        title: "Missing information",
        description: "Please enter a description and select a project before starting the timer.",
        variant: "destructive",
      });
      return;
    }
    
    const now = Date.now();
    setStartTime(now);
    setIsTracking(true);
    console.log("Timer started at:", new Date(now).toISOString());
  };
  
  // Stop the timer and save time entry
  const stopTimer = async () => {
    console.log("Stopping timer...");
    
    if (isTracking && startTime && selectedProjectId) {
      const endTime = Date.now();
      const duration = calculateDuration(startTime, endTime);
      
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(endTime);
      
      // Format dates for display
      const dateStr = format(startDateTime, 'yyyy-MM-dd');
      const monthStr = format(startDateTime, 'MMMM');
      const yearNum = startDateTime.getFullYear();
      
      // Calculate week number and label
      const weekNum = Math.ceil(startDateTime.getDate() / 7);
      const weekLabel = `Week ${weekNum}`;
      
      console.log("Saving time entry with duration:", duration);
      
      // Check for existing entry with same description, project, and date
      try {
        const response = await fetch("/api/time-entries");
        const existingEntries = await response.json();
        
        console.log("Checking for existing entries on date:", dateStr);
        console.log("Looking for description:", description, "projectId:", selectedProjectId);
        console.log("All existing entries:", existingEntries.map((e: any) => ({
          id: e.id,
          description: e.description,
          projectId: e.projectId,
          date: e.date
        })));
        
        const todayEntry = existingEntries.find((entry: any) => 
          entry.description === description &&
          entry.projectId === selectedProjectId &&
          entry.date === dateStr
        );
        
        console.log("Found existing entry:", todayEntry);
        
        if (todayEntry) {
          // Update existing entry by adding the new duration
          const existingDuration = parseFloat(todayEntry.duration || "0");
          const newTotalDuration = existingDuration + duration;
          
          console.log(`Updating existing entry ${todayEntry.id}: ${existingDuration}h + ${duration}h = ${newTotalDuration}h`);
          
          // Update the existing entry
          await apiRequest("PUT", `/api/time-entries/${todayEntry.id}`, {
            description: todayEntry.description,
            projectId: todayEntry.projectId,
            startTime: todayEntry.startTime,
            endTime: endDateTime,
            duration: newTotalDuration.toString(),
            date: todayEntry.date,
            month: todayEntry.month,
            year: todayEntry.year,
            weekNumber: todayEntry.weekNumber,
            weekLabel: todayEntry.weekLabel,
            billable: todayEntry.billable
          });
          
          console.log("Successfully updated existing entry");
          
          // Invalidate cache to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
          
          toast({
            title: "Time added to existing entry",
            description: `Added ${duration.toFixed(4)} hours to today's entry. Total: ${newTotalDuration.toFixed(4)} hours`,
          });
        } else {
          console.log("No existing entry found, creating new one");
          
          // Create new entry using direct API call instead of mutation
          await apiRequest("POST", "/api/tracker/time-entries", {
            description,
            projectId: selectedProjectId,
            startTime: startDateTime,
            endTime: endDateTime,
            duration: duration.toString(),
            date: dateStr,
            month: monthStr,
            year: yearNum,
            weekNumber: weekNum,
            weekLabel: weekLabel,
            billable: true,
          });
          
          // Invalidate cache to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
          
          toast({
            title: "Time entry saved",
            description: `Saved ${duration.toFixed(4)} hours`,
          });
        }
      } catch (error) {
        console.error("Error saving time entry:", error);
        toast({
          title: "Error",
          description: "Failed to save time entry. Please try again.",
          variant: "destructive",
        });
      }
      
      // Reset timer state
      setIsTracking(false);
      setStartTime(null);
    }
  };
  
  return {
    isTracking,
    startTime,
    elapsedTime,
    description,
    setDescription,
    selectedClientId,
    setSelectedClientId,
    selectedProjectId,
    setSelectedProjectId,
    startTimer,
    stopTimer,
  };
}
