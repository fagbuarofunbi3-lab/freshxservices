import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { getContactWhatsapp, adminUpdateContactWhatsapp } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const getContact = useServerFn(getContactWhatsapp);
  const updateContact = useServerFn(adminUpdateContactWhatsapp);
  const { data } = useQuery({
    queryKey: ["contact-whatsapp"],
    queryFn: () => getContact({}),
  });
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.number) setNumber(data.number);
  }, [data?.number]);

  async function save() {
    if (!number.trim()) return toast.error("Enter a WhatsApp number");
    setSaving(true);
    try {
      const res = await updateContact({ data: { number } });
      toast.success("Contact number updated");
      setNumber(res.number);
      await qc.invalidateQueries({ queryKey: ["contact-whatsapp"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl">Site settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Edit values shown across the public website.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="h-4 w-4 text-primary" /> Contact Us WhatsApp number
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Used by the "Contact us" button on the homepage and by the Campus Ambassador page. Use international format (e.g. 2348132589218) or a local number starting with 0.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="2348132589218"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {data?.number && (
          <div className="mt-3 text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{data.number}</span>
          </div>
        )}
      </section>
    </div>
  );
}
