import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../ui/button.tsx"; 
import { AuthModal } from "../auth/AuthModal.tsx";

export function SignInButton({ className, style, onOpenChange }: { className?: string; style?: CSSProperties; onOpenChange?: (open: boolean) => void }) {
  const [modalOpen, setModalOpen] = useState(false);

  const setOpen = (open: boolean) => {
    setModalOpen(open);
    onOpenChange?.(open);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className ?? "cursor-pointer font-medium"} style={style}>
        Log In / Sign Up
      </Button>

      {/* State synced dynamic backdrop login modal panel portal drawer */}
      <AuthModal open={modalOpen} onOpenChange={setOpen} />
    </>
  );
}