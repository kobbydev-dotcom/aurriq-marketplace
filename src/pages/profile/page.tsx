import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Camera, ArrowLeft, Loader2, Phone, Bell, Store, MapPin, Crosshair, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";

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

const SERVICE_OPTIONS = [
  { value: "hair", label: "Hair styling" },
  { value: "barbering", label: "Barbering" },
  { value: "nails", label: "Nails" },
  { value: "lashes", label: "Lashes" },
  { value: "makeup", label: "Makeup" },
  { value: "skincare", label: "Skincare" },
  { value: "spa", label: "Spa / wellness" },
  { value: "braiding", label: "Braiding" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { signIn, signOut } = useAuthActions();

  // Convex data
  const user = useQuery(api.users.current);
  const hasPasswordAccount = useQuery((api as any).users.hasPasswordAccount) as boolean | undefined;
  const storeUser = useMutation(api.users.storeUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const scheduleDeletion = useMutation((api as any).accountDeletion.scheduleDeletion);
  const reactivateAccount = useMutation((api as any).accountDeletion.reactivateAccount);
  const purgeImmediately = useMutation((api as any).accountDeletion.purgeImmediately);
  const sendPasswordResetNotice = useAction((api as any).users.sendPasswordResetNotice);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const avatarUrl = useQuery(
    api.users.resolveAvatarUrl,
    user?.avatarStorageId ? { storageId: user.avatarStorageId } : "skip"
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [customServiceDescription, setCustomServiceDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [doabookproSlug, setDoabookproSlug] = useState("");
  const [locating, setLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionStep, setDeletionStep] = useState<"warning" | "confirm">("warning");
  const [deletionMode, setDeletionMode] = useState<"scheduled" | "immediate">("scheduled");
  const [deletionPasswords, setDeletionPasswords] = useState(["", "", ""]);
  const [deleting, setDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetMode, setResetMode] = useState<"reset" | "setup">("reset");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("aurriq_profile_saved") !== "true") return;
    sessionStorage.removeItem("aurriq_profile_saved");
    toast.success("Profile updated successfully!");
  }, []);

  // Sync fields from Convex when the user loads
  useEffect(() => {
    if (user) {
      void storeUser().catch((error) => console.error("Profile identity sync failed", error));
      setFullName(user.name ?? "");
      setPhone(user.phone ?? "");
      setNotifyEmail((user as any).notifyEmail ?? "");
      setBusinessType((user as any).businessType ?? "");
      setServiceTypes((user as any).serviceTypes ?? []);
      setCustomServiceDescription((user as any).customServiceDescription ?? "");
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
        serviceTypes,
        customServiceDescription: customServiceDescription.trim() || undefined,
        locationLabel: locationLabel.trim() || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        locationShared,
        doabookproSlug: doabookproSlug.trim() || undefined,
      });
      sessionStorage.setItem("aurriq_profile_saved", "true");
      window.location.replace(window.location.href);
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

  const requestPasswordReset = async () => {
    if (!user?.email) {
      toast.error("Your login email is unavailable. Please contact support.");
      return;
    }
    try {
      await sendPasswordResetNotice({});
      if (hasPasswordAccount) {
        await signIn("password", { email: user.email, flow: "reset" });
        setResetMode("reset");
      } else {
        if (newPassword.length < 6) {
          toast.error("Choose a password with at least 6 characters first.");
          return;
        }
        await signIn("password", { email: user.email, password: newPassword, flow: "signUp" });
        setResetMode("setup");
      }
      setResetSent(true);
      toast.success(phone ? "Reset code sent to your email and a notice was sent by SMS." : "Reset code sent to your login email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the reset code.");
    }
  };

  const completePasswordReset = async () => {
    if (!resetCode.trim() || newPassword.length < 6) {
      toast.error("Enter the code and a password with at least 6 characters.");
      return;
    }
    try {
      await signIn("password", {
        email: user?.email,
        flow: resetMode === "reset" ? "reset-verification" : "email-verification",
        code: resetCode.trim(),
        ...(resetMode === "reset" ? { newPassword } : {}),
      });
      setResetOpen(false);
      setResetSent(false);
      setResetCode("");
      setNewPassword("");
      toast.success("Your password has been reset successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That reset code is invalid or expired.");
    }
  };

  const displayImage = avatarUrl ?? user?.image;

  const closeDeletion = () => {
    if (deleting) return;
    setDeletionOpen(false);
    setDeletionStep("warning");
    setDeletionMode("scheduled");
    setDeletionPasswords(["", "", ""]);
  };

  const confirmDeletion = async () => {
    const password = deletionPasswords[0].trim();
    if (!password || (deletionMode === "immediate" && deletionPasswords.some((value) => value !== password))) {
      toast.error(deletionMode === "immediate" ? "Enter the same password in all three fields." : "Enter your password to continue.");
      return;
    }
    if (!user?.email) {
      toast.error("This account has no email available for password verification.");
      return;
    }
    setDeleting(true);
    try {
      await signIn("password", { email: user.email, password, flow: "signIn" });
      if (deletionMode === "immediate") {
        await purgeImmediately();
        await signOut();
        window.location.assign("/");
      } else {
        await scheduleDeletion();
        closeDeletion();
        toast.success("Deletion scheduled. You have 7 days to reactivate your account.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not verify your password.");
    } finally {
      setDeleting(false);
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
        {(user as any)?.isPendingDeletion && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-semibold">Account deletion is scheduled</p>
              <p className="mt-1 text-muted-foreground">Your account and marketplace records will be permanently deleted after 7 days.</p>
              <Button className="mt-3" size="sm" onClick={async () => { await reactivateAccount(); toast.success("Your account has been reactivated."); }}>Keep my account</Button>
            </div>
          </div>
        )}
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
                <Label className="pt-2">What services do you offer?</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SERVICE_OPTIONS.map((service) => (
                    <label key={service.value} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs cursor-pointer hover:border-primary/50">
                      <input
                        type="checkbox"
                        checked={serviceTypes.includes(service.value)}
                        onChange={(event) => setServiceTypes((current) => event.target.checked ? [...new Set([...current, service.value])] : current.filter((value) => value !== service.value))}
                      />
                      {service.label}
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Add another service or describe what you do..."
                  value={customServiceDescription}
                  onChange={(event) => setCustomServiceDescription(event.target.value)}
                  maxLength={500}
                />
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
                <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                  Reset password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Reset your password</DialogTitle>
                <DialogDescription>We will send a secure reset code to your login email{phone ? " and an SMS notice to your profile phone" : ""}.</DialogDescription>
              </DialogHeader>
              {!resetSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Your login email is <strong>{user?.email}</strong>.</p>
                  {hasPasswordAccount === false && <p className="text-sm text-muted-foreground">This Google/social account does not have an Aurriq password yet. Choose one below to link it to your existing account.</p>}
                  {hasPasswordAccount === false && <Input type="password" placeholder="Choose a password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />}
                  <Button onClick={requestPasswordReset} className="w-full">{hasPasswordAccount === false ? "Set up password" : "Send reset code"}</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input placeholder="Reset code from email" value={resetCode} onChange={(event) => setResetCode(event.target.value)} />
                  <Input type="password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  <Button onClick={completePasswordReset} className="w-full">Save new password</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive"><Trash2 className="size-5" /> Permanently delete account</CardTitle>
              <CardDescription>This removes your profile, products, clients, messages, sales records, and marketplace activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeletionOpen(true)} disabled={(user as any)?.isPendingDeletion}>Delete account permanently</Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={deletionOpen} onOpenChange={(open) => open ? setDeletionOpen(true) : closeDeletion()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{deletionStep === "warning" ? "Are you sure you want to delete your account?" : "Confirm permanent deletion"}</DialogTitle>
              <DialogDescription>
                {deletionStep === "warning"
                  ? "You will lose everything you have built on Aurriq, including products, clients, pending sales, messages, and account records."
                  : deletionMode === "immediate"
                    ? "Immediate deletion cannot be undone. Enter your password three times to erase your account now."
                    : "Enter your password. Your account will be scheduled for permanent deletion in 7 days, and you can reactivate it any time before then."}
              </DialogDescription>
            </DialogHeader>

            {deletionStep === "warning" ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">Pending sales and marketplace records will not remain after deletion. This action is permanent after the seven-day recovery window.</div>
                <label className="flex items-center gap-2"><input type="radio" checked={deletionMode === "scheduled"} onChange={() => setDeletionMode("scheduled")} /> Delete after 7 days so I can reactivate</label>
                <label className="flex items-center gap-2"><input type="radio" checked={deletionMode === "immediate"} onChange={() => setDeletionMode("immediate")} /> Delete everything immediately</label>
                <DialogFooter><Button variant="outline" onClick={closeDeletion}>Cancel</Button><Button variant="destructive" onClick={() => setDeletionStep("confirm")}>Yes, continue</Button></DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                {deletionPasswords.map((value, index) => (
                  <Input key={index} type="password" placeholder={deletionMode === "immediate" ? `Password confirmation ${index + 1}` : "Your password"} value={deletionMode === "scheduled" && index > 0 ? "" : value} disabled={deletionMode === "scheduled" && index > 0} onChange={(event) => setDeletionPasswords((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                ))}
                <p className="text-xs text-muted-foreground">Your password is verified through Aurriq sign-in and is never stored by this deletion form.</p>
                <DialogFooter><Button variant="outline" onClick={() => setDeletionStep("warning")} disabled={deleting}>Back</Button><Button variant="destructive" onClick={confirmDeletion} disabled={deleting}>{deleting ? "Verifying..." : deletionMode === "immediate" ? "Erase everything now" : "Schedule deletion"}</Button></DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Authenticated>
    </div>
  );
}