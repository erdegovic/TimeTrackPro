import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function useAuth() {
  const [_, navigate] = useLocation();
  
  // Query for the current user, with error handling for unauthorized cases
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    onError: () => {
      // Don't redirect if on login or register pages
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/register") {
        navigate("/login");
      }
    }
  });

  // Function to log the user out
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
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