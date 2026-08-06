import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useEffect } from "react";
import type { SubscriptionPlan } from "@shared/subscriptions";
import { isPublicRoute } from "@/lib/public-routes";

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
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: string;
  subscriptionRequestedPlan?: SubscriptionPlan | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
}

export function useAuth() {
  const [location, navigate] = useLocation();

  const { 
    data: user, 
    isLoading, 
    isError 
  } = useQuery<UserProfile | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", { credentials: "include" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error(`Authentication request failed (${response.status})`);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return null;
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
  });

  // Handle navigation based on authentication status
  useEffect(() => {
    if (isError || (!isLoading && user === null)) {
      // Don't redirect if on public pages
      if (!isPublicRoute(location)) {
        navigate("/login");
      }
    }
  }, [isError, isLoading, location, navigate, user]);

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
