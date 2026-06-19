import React, { useEffect } from "react"; // Added React import here
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const ComingSoonGuard = ({ children }: { children: React.ReactNode }) => { // Changed JSX.Element to React.ReactNode for better compatibility
  const navigate = useNavigate();
  const IS_LAUNCHED = false; 

  useEffect(() => {
    if (!IS_LAUNCHED) {
      toast.info("Marketplace Launching Soon");
      navigate("/");
    }
  }, [navigate, IS_LAUNCHED]);

  return IS_LAUNCHED ? children : null;
};