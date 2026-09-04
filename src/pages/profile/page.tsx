import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Camera, ArrowLeft, Loader2, Phone, Bell, Store, MapPin, Crosshair } from "lucide-react";
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
  const storeUser = useMutation(api.users.storeUser);
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
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [doabookproSlug, setDoabookproSlug] = useState("");
  const [locating, setLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Sync fields from Convex when the user loads
  useEffect(() => {
    if (user) {
      void storeUser().catch((error) => console.error("Profile identity sync failed", error));
      setFullName(user.name ?? "");
      setPhone(user.phone ?? "");
      setNotifyEmail((user as any).notifyEmail ?? "");
      setBusinessType((user as any).businessType ?? "");
      setLocationLabel((user as any).locationLabel ?? "");
      setLocationShared((user as any).locationShared ?? false);
      setDoabookproSlug((user as any).doabookproSlug ?? "");
      if (typeof (user as any).latitude === "number" && typeof (user as any).longitude === "number") {
        setCoords({ lat: (user as any).latitude, lng: (user as any).longitude });
      }
    }
  }, [user?._id, user?.name, storeUser]);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Your device/browser doesn't support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location captured — remember to Save Changes.");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. Check browser permission.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
        locationLabel: locationLabel.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        locationShared,
        doabookproSlug: doabookproSlug.trim() || undefined,
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

              <div className="space-y-2">
                <Label>DOABookPro booking page <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="flex items-center gap-0 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-3 text-sm text-muted-foreground bg-muted/50 border-r border-input h-10 flex items-center">https://</span>
                  <Input
                    className="border-0 rounded-none focus-visible:ring-0"
                    placeholder="yourshop"
                    value={doabookproSlug}
                    onChange={(e) => setDoabookproSlug(e.target.value)}
                  />
                  <span className="px-3 text-sm text-muted-foreground bg-muted/50 border-l border-input h-10 flex items-center">.doabookpro.com</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Link your booking page so buyers can book appointments with you directly from your products — and your booking page can show your shop.
                </p>
              </div>

              <Button onClick={handleSave} disabled={isLoading || !fullName.trim()}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Location Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="size-5" /> Location
              </CardTitle>
              <CardDescription>
                Share your shop's location so nearby buyers can discover you. This is opt-in — nothing is shown unless you turn on sharing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shop / area label</Label>
                <Input
                  placeholder="e.g. Osu, Accra — near Oxford Street"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">A friendly description of where your shop is.</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button type="button" variant="outline" onClick={detectLocation} disabled={locating} className="gap-2">
                  {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
                  {locating ? "Detecting..." : coords ? "Update my current location" : "Use my current location"}
                </Button>
                {coords && (
                  <p className="text-xs text-muted-foreground">
                    Captured: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setLocationShared((v) => !v)}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors cursor-pointer ${locationShared ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">Show my location to buyers</p>
                  <p className="text-xs text-muted-foreground">
                    {locationShared
                      ? "Your shop appears in the \"Near You\" section with your label and distance."
                      : "Turn on to appear in \"Near You\" results."}
                  </p>
                </div>
                <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${locationShared ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${locationShared ? "translate-x-5" : ""}`} />
                </span>
              </button>

              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isLoading ? "Saving..." : "Save Location"}
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