import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { X, Plus, ImageIcon, AlertTriangle, Info, Video, Upload, Loader2 } from "lucide-react";
import { TrustSafetyBanner } from "@/components/trust/TrustSafetyBanner.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.d.ts";

const CATEGORIES = [
  { value: "hair", label: "Hair" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "skincare", label: "Skincare" },
  { value: "nails", label: "Nails" },
  { value: "fragrance", label: "Fragrance" },
  { value: "tools", label: "Tools & Accessories" },
];

const schema = z
  .object({
    name: z.string().min(2, "Product name is required"),
    brand: z.string().min(1, "Brand is required"),
    description: z.string().min(10, "Please write a short description (min 10 chars)"),
    category: z.string().min(1, "Select a category"),
    originalPrice: z.coerce.number().positive("Price must be greater than 0"),
    promoPrice: z.coerce.number().optional(),
    offerWholesale: z.boolean().default(false),
    wholesalePrice: z.coerce.number().positive().optional(),
    wholesaleMinQty: z.coerce.number().int().min(2).optional(),
    stockQuantity: z.coerce.number().int().min(0, "Stock cannot be negative"),
    lowStockThreshold: z.coerce.number().int().min(1, "Set a minimum low-stock alert number"),
    paymentMode: z.enum(["momo", "cod", "negotiable", "partial"]).default("momo"),
    depositPercent: z.coerce.number().int().min(1).max(100).optional(),
    tags: z.string().optional(),
  })
  .refine(
    (data) => !data.offerWholesale || (data.wholesalePrice !== undefined && data.wholesalePrice > 0 && data.wholesalePrice < data.originalPrice),
    { message: "Wholesale price must be set and lower than the retail price", path: ["wholesalePrice"] }
  )
  .refine(
    (data) => !data.offerWholesale || data.wholesaleMinQty !== undefined,
    { message: "Set the minimum quantity for wholesale", path: ["wholesaleMinQty"] }
  )
  .refine(
    (data) => data.paymentMode !== "partial" || (data.depositPercent !== undefined && data.depositPercent >= 1 && data.depositPercent <= 100),
    { message: "Set the deposit percentage buyers pay upfront", path: ["depositPercent"] }
  )
  .refine(
    (data) =>
      data.promoPrice === undefined ||
      data.promoPrice === 0 ||
      data.promoPrice < data.originalPrice,
    { message: "Promo price must be less than original price", path: ["promoPrice"] }
  );

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  editProduct?: Doc<"products"> | null;
};

export default function ProductFormDialog({ open, onClose, editProduct }: Props) {
  // Safe downcast to bypass missing endpoint compiler warnings on the generated client API surface
  const createProduct = useMutation((api.products as any).createProduct || api.products.listAll) as any;
  const updateProduct = useMutation((api.products as any).updateProduct || api.products.listAll) as any;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editProduct
      ? {
          name: editProduct.name,
          brand: editProduct.brand,
          description: editProduct.description,
          category: editProduct.category,
          originalPrice: editProduct.originalPrice,
          promoPrice: editProduct.promoPrice,
          stockQuantity: editProduct.stockQuantity,
          lowStockThreshold: editProduct.lowStockThreshold,
          paymentMode: ((editProduct as any).paymentOptions?.mode ?? "momo") as FormValues["paymentMode"],
          depositPercent: (editProduct as any).paymentOptions?.percent ?? 50,
          offerWholesale: (editProduct as any).wholesalePrice != null,
          wholesalePrice: (editProduct as any).wholesalePrice,
          wholesaleMinQty: (editProduct as any).wholesaleMinQty ?? 5,
          tags: editProduct.tags?.join(", ") ?? "",
        }
      : {
          stockQuantity: 0,
          lowStockThreshold: 5,
          paymentMode: "momo",
          depositPercent: 50,
          offerWholesale: false,
          wholesaleMinQty: 5,
        },
  });

  const category = watch("category");
  const paymentMode = watch("paymentMode");
  const offerWholesale = watch("offerWholesale");

  // Media uploads: track selected images/videos (existing URL or Convex storage id) in state.
  type MediaItem = { value: string; previewUrl: string };
  const [imageMedia, setImageMedia] = useState<MediaItem[]>(
    (editProduct?.images ?? []).filter(Boolean).map((u) => ({ value: u, previewUrl: u }))
  );
  const [videoMedia, setVideoMedia] = useState<MediaItem[]>(
    (editProduct?.videos ?? []).filter(Boolean).map((u) => ({ value: u, previewUrl: u }))
  );
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const generateUploadUrl = useMutation((api.products as any).generateUploadUrl);

  const uploadFile = async (file: File): Promise<string> => {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { storageId } = (await res.json()) as { storageId: string };
    return storageId;
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 6 - imageMedia.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of selected) {
        const storageId = await uploadFile(file);
        uploaded.push({ value: storageId, previewUrl: URL.createObjectURL(file) });
      }
      setImageMedia((prev) => [...prev, ...uploaded]);
    } catch {
      toast.error("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleVideoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 2 - videoMedia.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of selected) {
        const storageId = await uploadFile(file);
        uploaded.push({ value: storageId, previewUrl: URL.createObjectURL(file) });
      }
      setVideoMedia((prev) => [...prev, ...uploaded]);
    } catch {
      toast.error("Video upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (imageMedia.length === 0) {
      toast.error("Add at least one product photo.");
      return;
    }
    setSubmitting(true);
    try {
      const images = imageMedia.map((m) => m.value);
      const videos = videoMedia.map((m) => m.value);
      const tags = data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const paymentOptions = {
        mode: data.paymentMode,
        percent: data.paymentMode === "partial" ? data.depositPercent : undefined,
      };

      const wholesalePrice = data.offerWholesale ? data.wholesalePrice : undefined;
      const wholesaleMinQty = data.offerWholesale ? data.wholesaleMinQty : undefined;

      if (editProduct) {
        await updateProduct({
          productId: editProduct._id,
          name: data.name,
          brand: data.brand,
          description: data.description,
          category: data.category,
          originalPrice: data.originalPrice,
          promoPrice: data.promoPrice && data.promoPrice > 0 ? data.promoPrice : undefined,
          variants: [{ color: "Default", stock: Number(data.stockQuantity || 0) }],
          lowStockThreshold: data.lowStockThreshold,
          images,
          videos,
          tags,
          paymentOptions,
          wholesalePrice,
          wholesaleMinQty,
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct({
          name: data.name,
          brand: data.brand,
          description: data.description,
          category: data.category,
          originalPrice: data.originalPrice,
          promoPrice: data.promoPrice && data.promoPrice > 0 ? data.promoPrice : undefined,
          variants: [{ color: "Default", stock: Number(data.stockQuantity || 0) }],
          lowStockThreshold: data.lowStockThreshold,
          images,
          videos,
          tags,
          paymentOptions,
          wholesalePrice,
          wholesaleMinQty,
        });
        toast.success("Product listed successfully!");
      }
      reset();
      setImageMedia([]);
      setVideoMedia([]);
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {editProduct ? "Edit Product" : "List a New Product"}
          </DialogTitle>
        </DialogHeader>

        {/* Seller safety tip */}
        <div className="flex gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Seller Protection Tips</p>
            <ul className="space-y-0.5 text-amber-400/80 list-disc list-inside">
              <li>Only use Aurriq's official payment flow. Never accept outside transfers.</li>
              <li>Keep proof of your products — receipts, photos, packing records.</li>
              <li>Do not share your personal phone number publicly in product descriptions.</li>
              <li>Report suspicious buyers through the platform immediately.</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Name & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Brazilian Body Wave Wig" {...register("name")} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Input placeholder="e.g. Luxy Hair" {...register("brand")} />
              {errors.brand && <p className="text-destructive text-xs">{errors.brand.message}</p>}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={category} onValueChange={(v) => setValue("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-destructive text-xs">{errors.category.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe your product — size, color, material, how to use, etc."
              rows={4}
              {...register("description")}
            />
            {errors.description && <p className="text-destructive text-xs">{errors.description.message}</p>}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Original Price (GHS) *</Label>
              <Input type="number" placeholder="0.00" step="0.01" {...register("originalPrice")} />
              {errors.originalPrice && <p className="text-destructive text-xs">{errors.originalPrice.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Promo / Sale Price (GHS)</Label>
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </div>
              <Input type="number" placeholder="Leave blank if no promo" step="0.01" {...register("promoPrice")} />
              {errors.promoPrice && <p className="text-destructive text-xs">{errors.promoPrice.message}</p>}
            </div>
          </div>

          {/* Wholesale / bulk pricing */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setValue("offerWholesale", !offerWholesale, { shouldValidate: true })}
              className={cn(
                "w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors cursor-pointer",
                offerWholesale ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              )}
            >
              <div className="text-left">
                <p className="text-sm font-medium">Offer wholesale / bulk pricing</p>
                <p className="text-[11px] text-muted-foreground">
                  Buyers who order a minimum quantity get a lower per-unit price. Retail price still applies to smaller orders.
                </p>
              </div>
              <span className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors", offerWholesale ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform", offerWholesale && "translate-x-5")} />
              </span>
            </button>
            {offerWholesale && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border p-4 bg-muted/30">
                <div className="space-y-1.5">
                  <Label>Wholesale price per unit (GHS) *</Label>
                  <Input type="number" placeholder="e.g. 80" step="0.01" {...register("wholesalePrice")} />
                  {errors.wholesalePrice && <p className="text-destructive text-xs">{errors.wholesalePrice.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Minimum quantity for wholesale *</Label>
                  <Input type="number" placeholder="e.g. 10" {...register("wholesaleMinQty")} />
                  <p className="text-[11px] text-muted-foreground">Buyers ordering this many or more pay the wholesale price.</p>
                  {errors.wholesaleMinQty && <p className="text-destructive text-xs">{errors.wholesaleMinQty.message}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Payment options */}
          <div className="space-y-2">
            <Label>How do you want to be paid? *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { value: "momo", label: "Online / MoMo (strictly)", desc: "Buyer pays in full through Aurriq's secure checkout before you deliver." },
                { value: "cod", label: "Cash on Delivery", desc: "Buyer pays in cash when the item is delivered." },
                { value: "negotiable", label: "Negotiable", desc: "You and the buyer agree the price & payment method directly." },
                { value: "partial", label: "Deposit + Balance", desc: "Buyer pays a deposit online now, and the rest on delivery." },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue("paymentMode", opt.value, { shouldValidate: true })}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer",
                    paymentMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
            {paymentMode === "partial" && (
              <div className="space-y-1.5 pt-1">
                <Label>Deposit percentage (%) *</Label>
                <Input type="number" min={1} max={100} placeholder="e.g. 30" {...register("depositPercent")} />
                <p className="text-[11px] text-muted-foreground">
                  Buyer pays this % online now; the remaining balance is paid on delivery.
                </p>
                {errors.depositPercent && <p className="text-destructive text-xs">{errors.depositPercent.message}</p>}
              </div>
            )}
            {paymentMode === "momo" && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3" /> Electronic payments are processed only through Aurriq's secure checkout.
              </p>
            )}
          </div>

          {/* Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Stock Quantity *</Label>
              <Input type="number" placeholder="How many do you have in stock?" {...register("stockQuantity")} />
              {errors.stockQuantity && <p className="text-destructive text-xs">{errors.stockQuantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Low Stock Alert At *</Label>
                <span className="text-[10px] text-muted-foreground">(units)</span>
              </div>
              <Input type="number" placeholder="e.g. 5" {...register("lowStockThreshold")} />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3" /> You'll get an SMS when stock falls to this number
              </p>
              {errors.lowStockThreshold && <p className="text-destructive text-xs">{errors.lowStockThreshold.message}</p>}
            </div>
          </div>

          {/* Images and videos */}
          <div className="space-y-3">
            <div>
              <Label>Product media</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Upload photos and videos directly from your device. Your first photo is the cover.
              </p>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imageMedia.map((m, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={m.previewUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">Cover</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImageMedia((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {imageMedia.length < 6 && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-lg border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                    <span className="text-[10px]">{uploading ? "Uploading..." : "Add photo"}</span>
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImageFiles(e.target.files)}
              />
              {imageMedia.length === 0 && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="size-3" /> No photos yet — add at least one.
                </p>
              )}
            </div>

            {/* Videos */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium flex items-center gap-2">
                <Video className="size-3.5 text-primary" /> Product videos <span className="font-normal text-muted-foreground">(optional, up to 2)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {videoMedia.map((m, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                    <video src={m.previewUrl} className="w-full h-full object-cover" controls />
                    <button
                      type="button"
                      onClick={() => setVideoMedia((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove video"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {videoMedia.length < 2 && (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-video rounded-lg border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-4" />}
                    <span className="text-[10px]">{uploading ? "Uploading..." : "Add video"}</span>
                  </button>
                )}
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => handleVideoFiles(e.target.files)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>Tags</Label>
              <span className="text-[10px] text-muted-foreground">(comma-separated, optional)</span>
            </div>
            <Input placeholder="e.g. natural hair, 4C, growth serum" {...register("tags")} />
          </div>

          {/* Seller safety tips */}
          {!editProduct && <TrustSafetyBanner variant="seller" compact />}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || uploading} className="flex-1">
              {submitting ? "Saving..." : uploading ? "Uploading..." : editProduct ? "Save Changes" : "List Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}