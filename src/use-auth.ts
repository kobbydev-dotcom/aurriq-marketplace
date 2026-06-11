import { useState, useEffect } from "react";
import { toast } from "sonner";   // Make sure you have sonner installed

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sellerId = localStorage.getItem("marketplace_seller_id");
    const subdomain = localStorage.getItem("marketplace_seller_subdomain");

    const isLoggedIn = !!sellerId || localStorage.getItem("isLoggedIn") === "true";

    setIsAuthenticated(isLoggedIn);
    setIsLoading(false);

    // Show welcome message after SSO
    if (sellerId && !localStorage.getItem("welcome_shown")) {
      const salonName = subdomain ? subdomain.replace(/_/g, " ") : "Your Salon";
      toast.success(`Welcome back, ${salonName}!`, {
        description: "You're now in your seller dashboard",
        duration: 4000,
      });
      localStorage.setItem("welcome_shown", "true");
    }
  }, []);

  const signout = async () => {
    localStorage.removeItem("marketplace_seller_id");
    localStorage.removeItem("marketplace_seller_subdomain");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("welcome_shown");
    
    setIsAuthenticated(false);
    window.location.href = "/";
  };

  const signin = async () => {
    window.location.href = "/auth/login";
  };

  return {
    isAuthenticated,
    isLoading,
    error: null,
    fetchToken: async () => "mock-session-token-12345",
    signin,
    signout,
  };
}

export function useUser() {
  const sellerId = localStorage.getItem("marketplace_seller_id");
  const subdomain = localStorage.getItem("marketplace_seller_subdomain");

  return {
    user: sellerId ? {
      id: sellerId,
      name: subdomain ? subdomain.replace(/_/g, " ") : "Salon Owner",
      email: "",
      role: "seller",
    } : null,
    isLoading: false,
  };
}