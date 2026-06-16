import { useState } from "react";
import { Button } from "../ui/button.tsx"; 
import { AuthModal } from "../auth/AuthModal.tsx";

export function SignInButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)} className="cursor-pointer font-medium">
        Log In / Sign Up
      </Button>

      {/* State synced dynamic backdrop login modal panel portal drawer */}
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}