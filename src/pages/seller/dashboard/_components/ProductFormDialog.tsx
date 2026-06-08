import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { X, Plus, ImageIcon, AlertTriangle, Info } from "lucide-react";
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
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

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
    stockQuantity: z.coerce.number().int().min(0, "Stock cannot be negative"),
    lowStockThreshold: z.coerce.number().int().min(1, "Set a minimum low-stock alert number"),
    imageUrl1: z.string().url("Enter a valid image URL").optional().or(z.literal("")),
    imageUrl2: z.string().url("Enter a valid image URL").optional().or(z.literal("")),
    imageUrl3: z.string().url("Enter a valid image URL").optional().or(z.literal("")),
    tags: z.string().optional(),
  })
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
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
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
          imageUrl1: editProduct.images[0] ?? "",
          imageUrl2: editProduct.images[1] ?? "",
          imageUrl3: editProduct.images[2] ?? "",
          tags: editProduct.tags?.join(", ") ?? "",
        }
      : {
          stockQuantity: 0,
          lowStockThreshold: 5,
        },
  });

  const category = watch("category");

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const images = [data.imageUrl1, data.imageUrl2, data.imageUrl3].filter(
        (u): u is string => !!u && u.length > 0
      );
      const tags = data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      if (editProduct) {
        await updateProduct({
          productId: editProduct._id,
          name: data.name,
          brand: data.brand,
          description: data.description,
          category: data.category,
          originalPrice: data.originalPrice,
          promoPrice: data.promoPrice && data.promoPrice > 0 ? data.promoPrice : undefined,
          stockQuantity: data.stockQuantity,
          lowStockThreshold: data.lowStockThreshold,
          images,
          tags,
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
          stockQuantity: data.stockQuantity,
          lowStockThreshold: data.lowStockThreshold,
          images,
          tags,
        });
        toast.success("Product listed successfully!");
      }
      reset();
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
              <Label>Original Price (₦) *</Label>
              <Input type="number" placeholder="0.00" step="0.01" {...register("originalPrice")} />
              {errors.originalPrice && <p className="text-destructive text-xs">{errors.originalPrice.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Promo / Sale Price (₦)</Label>
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </div>
              <Input type="number" placeholder="Leave blank if no promo" step="0.01" {...register("promoPrice")} />
              {errors.promoPrice && <p className="text-destructive text-xs">{errors.promoPrice.message}</p>}
            </div>
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

          {/* Images */}
          <div className="space-y-2">
            <Label>Product Images (URLs)</Label>
            <p className="text-[11px] text-muted-foreground">
              Paste direct image links (from your photo storage, Google Drive, etc). Add up to 3 photos.
            </p>
            <div className="space-y-2">
              {(["imageUrl1", "imageUrl2", "imageUrl3"] as const).map((field, i) => (
                <div key={field} className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-muted-foreground shrink-0" />
                  <Input placeholder={`Image ${i + 1} URL${i === 0 ? " (main photo)" : " (optional)"}`} {...register(field)} />
                </div>
              ))}
            </div>
            {(errors.imageUrl1 ?? errors.imageUrl2 ?? errors.imageUrl3) && (
              <p className="text-destructive text-xs">Please enter valid image URLs</p>
            )}
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
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Saving..." : editProduct ? "Save Changes" : "List Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
