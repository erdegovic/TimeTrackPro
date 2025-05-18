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
  const timerRef = useRef<number | null>(null);
  
  // Create time entry mutation
  const createTimeEntry = useMutation({
    mutationFn: async (timeEntry: Partial<TimeEntry>) => {
      return apiRequest("POST", "/api/time-entries", timeEntry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Time entry saved",
        description: "Your time entry has been saved successfully.",
      });
      
      // Reset form
      setDescription("");
      setElapsedTime(0);
    },
    onError: () => {
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
    
    if (isTracking && startTime) {
      // Initial calculation
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      // Set up timer to update every second
      const intervalId = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      timerRef.current = intervalId;
      console.log("Timer interval set:", intervalId);
    } else {
      // Clear timer when not tracking
      if (timerRef.current) {
        console.log("Clearing timer interval:", timerRef.current);
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        console.log("Cleanup: clearing timer interval:", timerRef.current);
        window.clearInterval(timerRef.current);
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
    setElapsedTime(0);
    
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
      
      // Prepare time entry data
      const timeEntry: Partial<TimeEntry> = {
        description,
        projectId: selectedProjectId,
        startTime: startDateTime,
        endTime: endDateTime,
        duration: duration.toString(), // Convert duration to string
        date: dateStr,
        month: monthStr,
        year: yearNum,
        weekNumber: weekNum,
        weekLabel: weekLabel,
        billable: true,
      };
      
      console.log("Saving time entry:", timeEntry);
      
      // Save time entry
      createTimeEntry.mutate(timeEntry);
      
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
