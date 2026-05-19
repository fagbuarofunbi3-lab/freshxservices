import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/lib/auth.functions";
import { useMe, useInvalidateMe } from "../__root";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: me } = useMe();
  const fn = useServerFn(updateProfile);
  const invalidate = useInvalidateMe();
  const [name, setName] = useState(me?.full_name ?? "");
  const [phone, setPhone] = useState(me?.whatsapp_number ?? "");
  const [lang, setLang] = useState<"en" | "pidgin">(me?.language_preference ?? "en");
  const [loading, setLoading] = useState(false);

  async function save(payload: { full_name?: string; whatsapp_number?: string; language_preference?: "en" | "pidgin" }) {
    setLoading(true);
    try {
      await fn({ data: payload });
      await invalidate();
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl">Settings</h1>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg">Profile</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp number</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={loading}
            onClick={() => save({ full_name: name, whatsapp_number: phone })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Save profile
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg">Language</h2>
        <div className="mt-4 inline-flex rounded-md border border-border p-1">
          {(["en", "pidgin"] as const).map((l) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                save({ language_preference: l });
              }}
              className={`rounded px-4 py-1.5 text-sm font-medium ${
                lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {l === "en" ? "English" : "Pidgin"}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
