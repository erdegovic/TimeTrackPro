import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useAuth() {
  const [location, navigate] = useLocation();
  
  // This hook now prioritizes server data over localStorage
  // Only use localStorage as fallback for better UX

  const { 
    data: user, 
    isLoading, 
    error, 
    isError 
  } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    initialData: getUserFromStorage
  });

  // Handle navigation based on authentication status
  useEffect(() => {
    if (isError) {
      // Don't redirect if on public pages
      const publicPaths = [
        "/login", 
        "/register", 
        "/verify-email", 
        "/forgot-password", 
        "/reset-password"
      ];
      
      if (!publicPaths.some(path => location.startsWith(path))) {
        navigate("/login");
      }
    }
  }, [isError, location, navigate]);

  // Function to log the user out
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      // Clear stored profile data on logout
      localStorage.removeItem('userData');
      
      // Clear all queries and redirect to login
      queryClient.clear();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout
  };
}