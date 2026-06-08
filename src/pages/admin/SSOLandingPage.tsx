import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SSOLandingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (!token) { navigate("/"); return; }

    fetch("https://doabookpro.com/api/auth/verify-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.seller_id) {
          localStorage.setItem("marketplace_seller_id", data.seller_id);
          localStorage.setItem("marketplace_seller_subdomain", data.subdomain);
          navigate("/seller/dashboard");
        } else {
          navigate("/");
        }
      })
      .catch(() => navigate("/"));
  }, []);

  return <p style={{ padding: 40 }}>Signing you in…</p>;
}
