import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SSOLandingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      navigate("/"); 
      return;
    }

    // Use the correct main app domain
    fetch("https://kobby.doabookpro.com/api/auth/verify-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.seller_id) {
          localStorage.setItem("marketplace_seller_id", data.seller_id);
          localStorage.setItem("marketplace_seller_subdomain", data.subdomain || "");
          
          console.log("[SSO Success] Logged in seller:", data.seller_id);
          navigate("/seller/dashboard");   // Change this if your dashboard route is different
        } else {
          console.log("[SSO Failed]", data);
          navigate("/?error=invalid-sso");
        }
      })
      .catch((err) => {
        console.error("[SSO Error]", err);
        navigate("/?error=sso-failed");
      })
      .finally(() => setLoading(false));
  }, [navigate, params]);

  if (loading) {
    return (
      <div style={{ padding: "80px 40px", textAlign: "center", fontSize: "18px" }}>
        Signing you in securely…
      </div>
    );
  }

  return null;
}