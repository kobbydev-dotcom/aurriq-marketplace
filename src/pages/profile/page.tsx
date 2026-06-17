import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Camera, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";

export default function ProfilePage() {
  const navigate = useNavigate();
  
  // Convex data
  const user = useQuery(api.users.current);
  const updateProfile = useMutation(api.users.updateProfile); // We'll create this mutation

  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Sync name from Convex when it loads
  useEffect(() => {
    if (user?.name) {
      setFullName(user.name);
    }
  }, [user?.name]);

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .filter((n) => n.length > 0)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Please enter a full name");
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({ name: fullName.trim() });
      toast.success("Profile updated successfully!");
      // No need for reload anymore — Convex will update automatically
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6 gap-2">
        <ArrowLeft className="size-4" /> Back to Home
      </Button>

      <Unauthenticated>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">You need to be signed in to view this page.</p>
          <SignInButton />
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="mb-8">
          <h1 className="text-3xl font-serif tracking-tight">My Profile</h1>
          <p className="text-muted-foreground">Manage your account details.</p>
        </div>

        <div className="space-y-6">
          {/* Avatar Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Picture</CardTitle>
              <CardDescription>Update your public avatar.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="size-20 rounded-full bg-muted flex items-center justify-center border-2 border-border relative group cursor-pointer overflow-hidden text-xl font-bold text-muted-foreground">
                {user?.image ? (
                  <img 
                    src={user.image} 
                    alt={user.name || ""} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(user?.name || fullName)
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white size-6" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-xl font-bold">{user?.name || fullName || "Add your name"}</p>
                <p className="text-sm text-muted-foreground">Premium Member</p>
              </div>

              <div className="ml-auto">
                <Button variant="outline" onClick={() => toast.info("Image upload coming soon!")}>
                  Change Photo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    placeholder="Enter your full name" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-9" value={user?.email || ""} disabled />
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} disabled={isLoading || !fullName.trim()}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="size-5" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Last updated 3 months ago</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.error("Password reset link sent to email")}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Authenticated>
    </div>
  );
}