import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../ui/button.tsx"; 
import { AuthModal } from "../auth/AuthModal.tsx";

export function SignInButton({ className, style }: { className?: string; style?: CSSProperties }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)} className={className ?? "cursor-pointer font-medium"} style={style}>
        Log In / Sign Up
      </Button>

      {/* State synced dynamic backdrop login modal panel portal drawer */}
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}