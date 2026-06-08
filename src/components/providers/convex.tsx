import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3210"; 
const convex = new ConvexReactClient(convexUrl);

const mockJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwibmFtZSI6IkNoYW50ZWxsZSIsImV4cCI6NDY3MDUxODQwMH0.dGVzdF9zaWduYXR1cmU";

// 1. Declaring these outside the hook guarantees their references never change
const stableFetchToken = async () => mockJWT;

const stableAuthResponse = {
  isAuthenticated: true,
  isLoading: false,
  fetchAccessToken: stableFetchToken,
  fetchToken: stableFetchToken,
};

function useLocalMockAuth() {
  // 2. Returning the exact same static object stops the re-render loop
  return stableAuthResponse;
}

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useLocalMockAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}