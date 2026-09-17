import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Phone, Video, Upload, X, ShieldCheck, ShieldAlert } from "lucide-react";
import { adminSearchUsers, adminSetUserRole } from "@/lib/admin.functions";
import { UserRole, getRoleBadge } from "@/lib/auth.functions";
import {
  getContactWhatsapp,
  adminUpdateContactWhatsapp,
  getSiteMedia,
  adminUpdateSiteMedia,
  adminCreateSignedMediaUpload,
  adminFinalizeMediaUpload,
} from "@/lib/site-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
});

async function uploadFile(
  file: File,
  kind: "video" | "image",
  signFn: (args: { data: { kind: "video" | "image"; ext: string } }) => Promise<{ path: string; token: string }>,
  finalizeFn: (args: { data: { path: string } }) => Promise<{ url: string }>,
): Promise<string> {
  const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
  const { path } = await signFn({ data: { kind, ext } });
  if (path.startsWith("http")) {
    await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
  }
  const { url } = await finalizeFn({ data: { path } });
  return url;
}


function AdminSettingsPage() {
  const qc = useQueryClient();
  const getContact = useServerFn(getContactWhatsapp);
  const updateContact = useServerFn(adminUpdateContactWhatsapp);
  const getMedia = useServerFn(getSiteMedia);
  const updateMedia = useServerFn(adminUpdateSiteMedia);
  const signUpload = useServerFn(adminCreateSignedMediaUpload);
  const finalizeUpload = useServerFn(adminFinalizeMediaUpload);

  const { data: contact } = useQuery({
    queryKey: ["contact-whatsapp"],
    queryFn: () => getContact({}),
  });
  const { data: media } = useQuery({
    queryKey: ["site-media"],
    queryFn: () => getMedia({}),
  });

  const [number, setNumber] = useState("");
  const [savingNum, setSavingNum] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<string[]>(["", "", "", ""]);
  const [savingMedia, setSavingMedia] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const imageRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (contact?.number) setNumber(contact.number);
  }, [contact?.number]);

  useEffect(() => {
    if (media) {
      setVideoUrl(media.video_url ?? "");
      const list = [...(media.images ?? [])];
      while (list.length < 4) list.push("");
      setImages(list.slice(0, 4));
    }
  }, [media]);

  async function saveNumber() {
    if (!number.trim()) return toast.error("Enter a WhatsApp number");
    setSavingNum(true);
    try {
      const res = await updateContact({ data: { number } });
      toast.success("Contact number updated");
      setNumber(res.number);
      await qc.invalidateQueries({ queryKey: ["contact-whatsapp"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingNum(false);
    }
  }

  async function persistMedia(nextVideo: string, nextImages: string[]) {
    const cleaned = nextImages.map((s) => s.trim()).filter(Boolean);
    const res = await updateMedia({
      data: { video_url: nextVideo.trim(), images: cleaned },
    });
    setVideoUrl(res.video_url);
    const list = [...res.images];
    while (list.length < 4) list.push("");
    setImages(list.slice(0, 4));
    await qc.invalidateQueries({ queryKey: ["site-media"] });
  }

  async function saveMedia() {
    setSavingMedia(true);
    try {
      await persistMedia(videoUrl, images);
      toast.success("Media saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingMedia(false);
    }
  }

  async function onPickVideo(file: File) {
    if (file.size > 100 * 1024 * 1024) {
      return toast.error("Video must be under 100MB");
    }
    setUploadingVideo(true);
    try {
      const url = await uploadFile(file, "video", signUpload, finalizeUpload);
      setVideoUrl(url);
      await persistMedia(url, images);
      toast.success("Video uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function onPickImage(idx: number, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      return toast.error("Image must be under 10MB");
    }
    setUploadingImageIdx(idx);
    try {
      const url = await uploadFile(file, "image", signUpload, finalizeUpload);
      const next = [...images];
      next[idx] = url;
      setImages(next);
      await persistMedia(videoUrl, next);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingImageIdx(null);
    }
  }

  async function clearVideo() {
    setVideoUrl("");
    await persistMedia("", images);
  }

  async function clearImage(idx: number) {
    const next = [...images];
    next[idx] = "";
    setImages(next);
    await persistMedia(videoUrl, next);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl">Site settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit values shown across the website.
        </p>
      </div>

      {/* Contact number */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="h-4 w-4 text-primary" /> Contact Us WhatsApp number
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Used by the floating "Contact us" button and the homepage footer.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="2348132589218"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={saveNumber}
            disabled={savingNum}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {savingNum ? "Saving…" : "Save"}
          </button>
        </div>
        {contact?.number && (
          <div className="mt-3 text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{contact.number}</span>
          </div>
        )}
      </section>

      {/* Homepage video — file upload */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Video className="h-4 w-4 text-primary" /> Homepage promo video
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown to visitors before login. Upload an MP4 or WebM from your device (up to 100MB).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickVideo(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploadingVideo}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploadingVideo ? "Uploading…" : videoUrl ? "Replace video" : "Upload video"}
          </button>
          {videoUrl && (
            <button
              type="button"
              onClick={clearVideo}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-muted"
            >
              <X className="h-4 w-4" /> Remove
            </button>
          )}
        </div>

        {videoUrl && (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            className="mt-4 w-full max-w-md rounded-md border border-border bg-black"
          />
        )}
      </section>

      {/* Dashboard carousel — file upload */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" /> Dashboard picture strip
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Up to 4 images that scroll on every user's dashboard. Upload each from your device
          (up to 10MB each).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {images.map((val, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Picture {i + 1}</span>
                {val && (
                  <button
                    onClick={() => clearImage(i)}
                    className="inline-flex items-center gap-1 text-destructive hover:underline"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="relative h-32 w-full overflow-hidden rounded-md bg-muted">
                {val ? (
                  <img src={val} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Empty slot
                  </div>
                )}
              </div>
              <input
                ref={(el) => {
                  imageRefs.current[i] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickImage(i, f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => imageRefs.current[i]?.click()}
                disabled={uploadingImageIdx === i}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingImageIdx === i ? "Uploading…" : val ? "Replace" : "Upload"}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveMedia}
            disabled={savingMedia}
            className="rounded-md border border-border px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {savingMedia ? "Saving…" : "Save media"}
          </button>
        </div>
      </section>

      <AdminAccessSection />
    </div>
  );
}

const ADMIN_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "admin", label: "Super Admin", desc: "Full master access: settings, system config, role assignments" },
  { value: "operations", label: "Operations Admin", desc: "Manages orders fulfillment, catalog services, vetted professionals" },
  { value: "finance", label: "Finance Admin", desc: "Manages customer wallet adjustments, promo codes, referral payouts, revenue" },
  { value: "support", label: "Support Admin", desc: "Customer care: view orders, read-only customer details, notifications" },
  { value: "customer", label: "Customer", desc: "Standard customer account with no administrative access" },
];

function AdminAccessSection() {
  const search = useServerFn(adminSearchUsers);
  const setRole = useServerFn(adminSetUserRole);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: results, refetch, isFetching } = useQuery({
    queryKey: ["admin-user-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setBusyId(userId);
    try {
      await setRole({ data: { user_id: userId, profile_id: userId, role: newRole } });
      toast.success(`Role updated to ${getRoleBadge(newRole).label}`);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update role");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" /> Admin & Staff Access (RBAC)
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Assign role-based administrative permissions to team members. Each role unlocks specific back-office tabs and capabilities.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ADMIN_ROLES.filter((r) => r.value !== "customer").map((r) => {
          const badge = getRoleBadge(r.value);
          return (
            <div key={r.value} className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{r.label}</span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${badge.color}`}>
                  {r.value}
                </span>
              </div>
              <p className="mt-1.5 text-muted-foreground text-[11px] leading-relaxed">{r.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / WhatsApp / email to assign roles…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {q.trim().length >= 2 && (
        <div className="mt-4 divide-y divide-border rounded-md border border-border">
          {isFetching && !results ? (
            <div className="p-3 text-sm text-muted-foreground">Searching users…</div>
          ) : (results?.length ?? 0) === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No users found.</div>
          ) : (
            results!.map((u) => {
              const currentRole = (u.role as UserRole) || "customer";
              const badge = getRoleBadge(currentRole);
              return (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.full_name || "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.whatsapp_number}
                      {u.email ? ` · ${u.email}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    <select
                      value={currentRole}
                      disabled={busyId === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary disabled:opacity-50"
                    >
                      {ADMIN_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

