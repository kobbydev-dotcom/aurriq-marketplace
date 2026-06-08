export function useAuth() {
  return {
    isAuthenticated: true, 
    isLoading: false,
    error: null as Error | null,
    // Convex needs this function to authenticate database queries!
    fetchToken: async () => "mock-session-token-12345", 
    signin: async () => {},
    signout: async () => {
      alert("Testing Mode: Logout disabled.");
    },
  };
}

export function useUser() {
  return {
    user: {
      id: "test-user-123",
      name: "Chantelle Beauty",
      email: "chantelle@example.com",
      phone: "+233201234567", 
      role: "seller",         
    },
    isLoading: false,
  };
}