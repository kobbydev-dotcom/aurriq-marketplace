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
          navigate("/seller/dashboard");
        } else {
          // If token verification fails or no seller_id, go to homepage
          navigate("/");
        }
      })
      .catch((err) => {
        console.error("[SSO Error]", err);
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [navigate, params]);

  if (loading) {
    return (
      <div style={{ padding: "100px 20px", textAlign: "center", fontSize: "18px" }}>
        Connecting to marketplace...
      </div>
    );
  }

  return null;
}
