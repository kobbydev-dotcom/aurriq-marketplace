import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Sparkles, Mail, Chrome, Laptop, Apple, Facebook } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Label } from "../ui/label.tsx";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

const signUpSchema = loginSchema.extend({
  fullName: z.string().min(2, "Full name is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signIn } = useAuthActions();
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [isFullSignUpFlow, setIsFullSignUpFlow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });
  const signUpForm = useForm<SignUpFormValues>({ resolver: zodResolver(signUpSchema) });

  const toggleAccordion = (provider: string) => {
    setActiveAccordion(activeAccordion === provider ? null : provider);
  };

  const handleLogin = async (data: LoginFormValues) => {
    setSubmitting(true);
    const toastId = toast.loading("Logging you in securely...");
    try {
      await signIn("password", { email: data.email, password: data.password, flow: "signIn" });
      toast.success("Welcome back to Aurriq!", { id: toastId });
      onOpenChange(false);
    } catch (err) {
      toast.error("Invalid credentials. Please try again.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (data: SignUpFormValues) => {
    setSubmitting(true);
    const toastId = toast.loading("Creating your luxury profile...");
    try {
      await signIn("password", { email: data.email, password: data.password, name: data.fullName, flow: "signUp" });
      toast.success("Account created successfully!", { id: toastId });
      onOpenChange(false);
    } catch (err) {
      toast.error("Registration failed. Email might already be taken.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  // Click handler to catch social platforms like Google vs credential forms
  const handleMethodClick = async (providerId: string) => {
    if (providerId === "gmail") {
      setSubmitting(true);
      const toastId = toast.loading("Connecting with Google...");
      try {
        await signIn("google");
        toast.success("Welcome to Aurriq!", { id: toastId });
        onOpenChange(false);
      } catch (err) {
        toast.error("Google authentication failed. Please try again.", { id: toastId });
      } finally {
        setSubmitting(false);
      }
    } else {
      // Keep accordion drawer functionality for regular logins (like DOABookPro credentials)
      toggleAccordion(providerId);
    }
  };

  const providers = [
    { id: "yahoo", name: "Continue with Yahoo", icon: <span className="font-serif font-black text-purple-600 lowercase text-sm">Y!</span> },
    { id: "apple", name: "Continue with Apple", icon: <Apple className="size-4 text-black fill-black" /> },
    { id: "microsoft", name: "Continue with Microsoft", icon: <Laptop className="size-4 text-blue-500" /> },
    { id: "gmail", name: "Continue with Gmail", icon: <Chrome className="size-4 text-red-500" /> },
    { id: "email", name: "Continue with email", icon: <Mail className="size-4 text-muted-foreground" /> },
    { id: "facebook", name: "Continue with Facebook", icon: <Facebook className="size-4 text-blue-600 fill-blue-600" /> },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background border border-border shadow-2xl rounded-2xl p-6 z-50 outline-none max-h-[90vh] overflow-y-auto transition-all">
          
          <div className="text-center relative mb-6">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Sparkles className="size-5 text-primary" />
            </div>
            <Dialog.Title className="text-2xl font-light tracking-wide" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Aurriq
            </Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground mt-1">
              {isFullSignUpFlow ? "Sign up to unlock luxury access" : "Log In or Sign Up"}
            </Dialog.Description>
            <Dialog.Close className="absolute right-0 top-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-md outline-none">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {isFullSignUpFlow ? (
            <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Full Name</Label>
                <Input id="su-name" placeholder="Jane Doe" {...signUpForm.register("fullName")} />
                {signUpForm.formState.errors.fullName && <p className="text-destructive text-[11px]">{signUpForm.formState.errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email Address</Label>
                <Input id="su-email" type="email" placeholder="you@example.com" {...signUpForm.register("email")} />
                {signUpForm.formState.errors.email && <p className="text-destructive text-[11px]">{signUpForm.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" type="password" placeholder="••••••••" {...signUpForm.register("password")} />
                {signUpForm.formState.errors.password && <p className="text-destructive text-[11px]">{signUpForm.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={submitting} className="w-full mt-2 cursor-pointer">
                {submitting ? "Registering account..." : "Register Profile"}
              </Button>
              <div className="text-center pt-2">
                <button type="button" onClick={() => setIsFullSignUpFlow(false)} className="text-xs text-primary font-medium hover:underline bg-transparent border-none cursor-pointer">
                  Back to Log In methods
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5">
              {providers.map((p) => {
                const isOpen = activeAccordion === p.id;
                return (
                  <div key={p.id} className="border border-border/60 rounded-xl overflow-hidden transition-all bg-card">
                    <button
                      type="button"
                      onClick={() => handleMethodClick(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-medium hover:bg-muted/40 transition-colors cursor-pointer outline-none"
                    >
                      {p.icon}
                      <span className="flex-1 text-foreground/80">{p.name}</span>
                    </button>

                    <div className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[240px] opacity-100 border-t border-border/40 p-4" : "max-h-0 opacity-0 pointer-events-none"}`}>
                      {isOpen && (
                        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Enter your {p.name.replace("Continue with ", "")} credentials</p>
                          <div>
                            <Input size={32} type="email" placeholder="Email address" className="h-8 text-xs" {...loginForm.register("email")} />
                            {loginForm.formState.errors.email && <p className="text-destructive text-[10px] mt-0.5">{loginForm.formState.errors.email.message}</p>}
                          </div>
                          <div>
                            <Input size={32} type="password" placeholder="Password" className="h-8 text-xs" {...loginForm.register("password")} />
                            {loginForm.formState.errors.password && <p className="text-destructive text-[10px] mt-0.5">{loginForm.formState.errors.password.message}</p>}
                          </div>
                          <Button type="submit" disabled={submitting} size="sm" className="w-full h-8 text-xs tracking-wide cursor-pointer mt-1">
                            {submitting ? "Verifying..." : "Log In"}
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="text-center pt-4 border-t border-border/40 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsFullSignUpFlow(true);
                    setActiveAccordion(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none font-normal"
                >
                  New to Aurriq? <span className="font-semibold text-primary hover:underline">Sign up to Aurriq</span>
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}