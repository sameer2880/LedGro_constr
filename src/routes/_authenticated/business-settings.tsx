import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageUp, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminOnly } from "@/components/AdminOnly";
import { useSession } from "@/lib/auth/session";
import { PLATFORM_NAME } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/business-settings")({
  head: () => ({
    meta: [{ title: `Business Settings — ${PLATFORM_NAME}` }, { name: "robots", content: "noindex" }],
  }),
  component: BusinessSettings,
});

type ImageKey = "logo_url" | "stamp_url" | "signature_url";

const BUCKET = "business-assets";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function ImageField({
  label,
  hint,
  value,
  businessId,
  kind,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  businessId: string;
  kind: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image file");
    if (file.size > MAX_IMAGE_BYTES) return void toast.error("Image must be under 2 MB");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      // Files live in a folder named after the business — the storage policy only lets
      // that business's admin write there.
      const path = `${businessId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      onChange(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {value ? <img src={value} alt={label} className="h-full w-full object-contain" /> : <ImageUp className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} className="mt-1.5" />
      </div>
    </div>
  );
}

function BusinessSettings() {
  const { business } = useSession();
  const [form, setForm] = useState({
    name: "",
    short_name: "",
    location: "",
    owner_line: "",
    phone: "",
    whatsapp: "",
    website_url: "",
    instagram_url: "",
    youtube_url: "",
    maps_url: "",
    reels_url: "",
    logo_url: "",
    stamp_url: "",
    signature_url: "",
  });

  useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name,
      short_name: business.short_name ?? "",
      location: business.location ?? "",
      owner_line: business.owner_line ?? "",
      phone: business.phone ?? "",
      whatsapp: business.whatsapp ?? "",
      website_url: business.website_url ?? "",
      instagram_url: business.instagram_url ?? "",
      youtube_url: business.youtube_url ?? "",
      maps_url: business.maps_url ?? "",
      reels_url: business.reels_url ?? "",
      logo_url: business.logo_url ?? "",
      stamp_url: business.stamp_url ?? "",
      signature_url: business.signature_url ?? "",
    });
  }, [business]);

  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business selected");
      if (form.name.trim().length < 2) throw new Error("Business name is required");
      const nullable = (v: string) => v.trim() || null;
      const { error } = await supabase
        .from("businesses")
        .update({
          name: form.name.trim(),
          short_name: nullable(form.short_name),
          location: nullable(form.location),
          owner_line: nullable(form.owner_line),
          phone: nullable(form.phone),
          whatsapp: nullable(form.whatsapp.replace(/\D/g, "")),
          website_url: nullable(form.website_url),
          instagram_url: nullable(form.instagram_url),
          youtube_url: nullable(form.youtube_url),
          maps_url: nullable(form.maps_url),
          reels_url: nullable(form.reels_url),
          logo_url: nullable(form.logo_url),
          stamp_url: nullable(form.stamp_url),
          signature_url: nullable(form.signature_url),
        })
        .eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Business settings saved");
      // Reload so the sidebar, receipts and messages pick up the new branding everywhere.
      window.setTimeout(() => window.location.reload(), 600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof typeof form, label: string, placeholder?: string) => (
    <div>
      <Label>{label}</Label>
      <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
    </div>
  );

  return (
    <AdminOnly label="Business Settings">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Settings className="h-6 w-6 text-primary" /> Business Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Your business's name, contact details and receipt branding. These appear in the app, on printed receipts
            and in WhatsApp messages to customers.
          </p>
        </div>

        {!business ? (
          <p className="py-10 text-center text-muted-foreground">Open a business first.</p>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3 p-4">
                {field("name", "Business name")}
                <div className="grid grid-cols-2 gap-3">
                  {field("location", "Location")}
                  {field("short_name", "Short name")}
                </div>
                {field("owner_line", "Receipt contact line", "Pro: Owner Name Ph.no: 9876543210")}
                <div className="grid grid-cols-2 gap-3">
                  {field("phone", "Phone")}
                  {field("whatsapp", "WhatsApp number", "with country code, e.g. 919876543210")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <ImageField label="Logo" hint="Square image works best." value={form.logo_url} businessId={business.id} kind="logo" onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
                <ImageField label="Stamp" hint="Transparent PNG, printed on receipts." value={form.stamp_url} businessId={business.id} kind="stamp" onChange={(url) => setForm((f) => ({ ...f, stamp_url: url }))} />
                <ImageField label="Authorised signature" hint="Transparent PNG, printed on receipts." value={form.signature_url} businessId={business.id} kind="signature" onChange={(url) => setForm((f) => ({ ...f, signature_url: url }))} />
                <p className="text-xs text-muted-foreground">
                  Uploaded images are publicly viewable by link (receipts need them). Only upload artwork you are happy
                  for customers to see.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Links shown in "Explore more" (all optional)</p>
                {field("website_url", "Website", "https://")}
                {field("instagram_url", "Instagram", "https://")}
                {field("youtube_url", "YouTube", "https://")}
                {field("maps_url", "Map location", "https://")}
                {field("reels_url", "Reel manager link", "https://")}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </>
        )}
      </div>
    </AdminOnly>
  );
}
