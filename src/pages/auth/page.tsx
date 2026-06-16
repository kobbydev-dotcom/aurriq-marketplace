import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react"; // 1. Added live auth actions hook
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Lock, Mail, Chrome, Sparkles } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  fullName: z.string().optional(),
});

type AuthFormValues = z.infer<typeof authSchema>;

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn } = useAuthActions(); // 2. Destructured live backend signIn executor
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "", fullName: "" },
  });

  const onSubmit = async (data: AuthFormValues) => {
    setSubmitting(true);
    const toastId = toast.loading(isSignUp ? "Creating your profile..." : "Signing you in securely...");
    
    try {
      if (isSignUp) {
        if (!data.fullName) {
          toast.error("Please fill in your full name to sign up!", { id: toastId });
          setSubmitting(false);
          return;
        }
        
        // 3. Official Convex Auth Sign Up Pipeline Flow
        await signIn("password", { 
          email: data.email, 
          password: data.password, 
          name: data.fullName,
          flow: "signUp" 
        });
        toast.success("Account created successfully!", { id: toastId });
      } else {
        // 4. Official Convex Auth Log In Pipeline Flow
        await signIn("password", { 
          email: data.email, 
          password: data.password, 
          flow: "signIn" 
        });
        toast.success("Welcome back!", { id: toastId });
      }
      
      // Send them straight into the operational seller panel view grid
      navigate("/seller/dashboard");
    } catch (err: any) {
      console.error("Auth Error Details:", err);
      // Handles smart account dynamic routing feedback check instructions
      if (err.message?.includes("InvalidPassword") || err.message?.includes("could not find account")) {
        toast.error("Invalid email or password combination.", { id: toastId });
      } else {
        toast.error("Authentication failed. Please verify your inputs.", { id: toastId });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="space-y-2 text-center">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Sparkles className="size-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {isSignUp ? "Create Your Account" : "Welcome to Aurriq"}
          </CardTitle>
          <CardDescription className="text-xs">
            {isSignUp 
              ? "Enter your details below to register a profile on our luxury marketplace" 
              : "Sign in using your password credentials or choose a connected account"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button" onClick={() => toast.info("Google OAuth provider incoming next build layout phase!")} className="w-full text-xs gap-2 cursor-pointer">
              <Chrome className="size-4 text-red-500" /> Google
            </Button>
            <Button variant="outline" type="button" onClick={() => toast.info("Yahoo OAuth provider incoming next build layout phase!")} className="w-full text-xs font-semibold tracking-wider gap-2 cursor-pointer text-purple-600">
              Y! Yahoo
            </Button>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <span className="relative bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-widest">Or continue with email</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" placeholder="Jane Doe" {...register("fullName")} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                <Input id="email" type="email" className="pl-9" placeholder="you@example.com" {...register("email")} />
              </div>
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <span className="text-[11px] text-primary hover:underline cursor-pointer">Forgot password?</span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                <Input id="password" type="password" className="pl-9" placeholder="••••••••" {...register("password")} />
              </div>
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button type="submit" disabled={submitting} className="w-full mt-2 font-medium tracking-wide cursor-pointer">
              {submitting ? "Authenticating securely..." : isSignUp ? "Sign Up Free" : "Log In Securely"}
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-2">
            {isSignUp ? "Already have an account profile?" : "New to the platform?"}{" "}
            <button 
              type="button" 
              onClick={() => setIsSignUp(!isSignUp)} 
              className="text-primary font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              {isSignUp ? "Log In here" : "Create an account instead"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}