import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Camera, ArrowLeft, Loader2, Phone, Bell, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";

const BUSINESS_TYPES = [
  { value: "", label: "Not a service business" },
  { value: "salon", label: "Salon / Hair Studio" },
  { value: "barbershop", label: "Barbershop" },
  { value: "nail_tech", label: "Nail Tech" },
  { value: "lash_tech", label: "Lash Tech" },
  { value: "makeup", label: "Makeup Artist" },
  { value: "spa", label: "Spa / Wellness" },
  { value: "other", label: "Other beauty service" },
];

export default function ProfilePage() {
  const navigate = useNavigate();

  // Convex data
  const user = useQuery(api.users.current);
  const updateProfile = useMutation(api.users.updateProfile);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const avatarUrl = useQuery(
    api.users.resolveAvatarUrl,
    user?.avatarStorageId ? { storageId: user.avatarStorageId } : "skip"
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Sync fields from Convex when the user loads
  useEffect(() => {
    if (user) {
      setFullName(user.name ?? "");
      setPhone(user.phone ?? "");
      setNotifyEmail((user as any).notifyEmail ?? "");
      setBusinessType((user as any).businessType ?? "");
    }
  }, [user]);

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
      await updateProfile({
        name: fullName.trim(),
        phone: phone.trim() || undefined,
        notifyEmail: notifyEmail.trim() || undefined,
        businessType: businessType || undefined,
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarFile = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await updateProfile({ avatarStorageId: storageId });
      toast.success("Profile photo updated!");
    } catch (e) {
      toast.error("Photo upload failed. Try again.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const displayImage = avatarUrl ?? user?.image;

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
          <p className="text-muted-foreground">Manage your account, contact, and business details.</p>
        </div>

        <div className="space-y-6">
          {/* Avatar Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Picture</CardTitle>
              <CardDescription>Upload a photo buyers and sellers will see.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="size-20 rounded-full bg-muted flex items-center justify-center border-2 border-border relative group cursor-pointer overflow-hidden text-xl font-bold text-muted-foreground"
                aria-label="Change profile photo"
              >
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={user?.name || ""}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(user?.name || fullName)
                )}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? <Loader2 className="text-white size-6 animate-spin" /> : <Camera className="text-white size-6" />}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
              />

              <div className="flex flex-col gap-1">
                <p className="text-xl font-bold">{user?.name || fullName || "Add your name"}</p>
                <p className="text-sm text-muted-foreground">
                  {(user as any)?.businessType
                    ? BUSINESS_TYPES.find((b) => b.value === (user as any).businessType)?.label
                    : "Aurriq Member"}
                </p>
              </div>

              <div className="ml-auto">
                <Button variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Camera className="mr-2 size-4" />}
                  {uploadingAvatar ? "Uploading..." : "Change Photo"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account + Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account & Contact</CardTitle>
              <CardDescription>Your name, contact number, and where notifications go.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-9" value={user?.email || ""} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact / WhatsApp Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="+233 24 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for instant SMS order alerts with a link to your dashboard.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notification Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="relative">
                    <Bell className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      type="email"
                      placeholder="Where to email order alerts"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defaults to your account email if left blank.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Do you run a service business?</Label>
                <div className="relative">
                  <Store className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                  >
                    {BUSINESS_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Buyers will see a badge (e.g. "Salon Owner") on your products — salon owners get priority placement with our DOABookPro booking platform.
                </p>
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