import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SSOLandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Securing your marketplace session...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function authenticateSSO() {
      console.log("SSO: Starting authentication...");
      const params = new URLSearchParams(location.search);
      const token = params.get("token");

      if (!token) {
        console.error("SSO: No token in URL");
        if (isMounted) {
          setHasError(true);
          setStatusMessage("Authentication failed: Missing secure handoff token.");
        }
        return;
      }

      try {
        console.log("SSO: Requesting verification from Flask...");
        const response = await fetch("http://localhost:5000/api/auth/verify-sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        console.log("SSO: Flask responded with", response.status);

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log("SSO: Verification successful, data:", data);
        
        localStorage.setItem("marketplace_seller_id", data.seller_id);
        localStorage.setItem("marketplace_subdomain", data.subdomain);
        
        if (isMounted) {
          setStatusMessage("Handoff verified! Redirecting...");
          // Reduced timeout to ensure faster feedback
          setTimeout(() => {
            console.log("SSO: Navigating to dashboard...");
            navigate("/seller/dashboard", { replace: true });
          }, 500);
        }

      } catch (error: any) {
        console.error("SSO Handoff Error:", error);
        if (isMounted) {
          setHasError(true);
          setStatusMessage(error.message || "An unexpected error occurred.");
        }
      }
    }

    authenticateSSO();

    return () => {
      isMounted = false;
    };
    // Removed location and navigate from dependencies to prevent re-triggering loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50 px-4" style={{ fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '400px', width: '100%', backgroundColor: '#fff', padding: '2rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        {!hasError ? (
          <div>
            <div style={{ animation: 'spin 1s linear infinite', border: '2px solid #e5e5e5', borderBottomColor: '#171717', borderRadius: '50%', width: '2.25rem', height: '2.25rem', margin: '0 auto' }}></div>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#262626', fontWeight: 500 }}>{statusMessage}</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', marginBottom: '1rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#171717', margin: '0 0 0.5rem 0' }}>Security Handoff Failed</h3>
            <p style={{ fontSize: '0.75rem', color: '#737373', margin: '0 0 1rem 0', lineHeight: '1.5' }}>{statusMessage}</p>
            <button 
              onClick={() => window.location.href = "http://127.0.0.1:5000/owner/dashboard"}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 500, color: '#404040', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              Return to Booking Dashboard
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}