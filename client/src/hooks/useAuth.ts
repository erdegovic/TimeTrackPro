import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useEffect } from "react";

// Define user type for TypeScript
export interface UserProfile {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  username: string;
  profileImageUrl?: string | null;
  status?: string;
  role?: string;
}

export function useAuth() {
  const [location, navigate] = useLocation();

  const { 
    data: user, 
    isLoading, 
    error, 
    isError 
  } = useQuery<UserProfile>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
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
      
      // No need to clear local storage as we're using the database now
      
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