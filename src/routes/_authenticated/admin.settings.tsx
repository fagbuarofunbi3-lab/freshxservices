import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Phone, Video } from "lucide-react";
import {
  getContactWhatsapp,
  adminUpdateContactWhatsapp,
  getSiteMedia,
  adminUpdateSiteMedia,
} from "@/lib/site-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const getContact = useServerFn(getContactWhatsapp);
  const updateContact = useServerFn(adminUpdateContactWhatsapp);
  const getMedia = useServerFn(getSiteMedia);
  const updateMedia = useServerFn(adminUpdateSiteMedia);

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

  async function saveMedia() {
    setSavingMedia(true);
    try {
      const cleaned = images.map((s) => s.trim()).filter(Boolean);
      const res = await updateMedia({
        data: { video_url: videoUrl.trim(), images: cleaned },
      });
      toast.success("Media updated");
      setVideoUrl(res.video_url);
      const list = [...res.images];
      while (list.length < 4) list.push("");
      setImages(list.slice(0, 4));
      await qc.invalidateQueries({ queryKey: ["site-media"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingMedia(false);
    }
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
          Used by the floating "Contact us" button and the homepage footer. International
          (2348132589218) or local (081...) format both work.
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

      {/* Homepage video */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Video className="h-4 w-4 text-primary" /> Homepage promo video
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown to visitors before login, above the "Available balance" preview. Paste a direct
          MP4/WebM URL or a YouTube link. Leave blank for a placeholder.
        </p>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or https://.../promo.mp4"
          className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </section>

      {/* Dashboard carousel */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="h-4 w-4 text-primary" /> Dashboard picture strip
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Up to 4 images shown as a rolling strip on every user's dashboard, between their
          current order and recent orders. Leave a slot blank to remove it.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {images.map((val, i) => (
            <div key={i} className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Picture {i + 1}
              </label>
              <input
                value={val}
                onChange={(e) => {
                  const next = [...images];
                  next[i] = e.target.value;
                  setImages(next);
                }}
                placeholder="https://.../image.jpg"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {val.trim() && (
                <div className="relative h-24 w-full overflow-hidden rounded-md bg-muted">
                  <img
                    src={val.trim()}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveMedia}
            disabled={savingMedia}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {savingMedia ? "Saving…" : "Save media"}
          </button>
        </div>
      </section>
    </div>
  );
}
