import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useState } from "react";
import { toast } from "sonner";
import { setTransactionPin, updateProfile, requestTransactionPinReset } from "@/lib/auth.functions";
import { useMe, useInvalidateMe } from "../__root";
import { PasswordInput } from "../signup";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: me } = useMe();
  const fn = useServerFn(updateProfile);
  const invalidate = useInvalidateMe();
  const [name, setName] = useState(me?.full_name ?? "");
  const [phone, setPhone] = useState(me?.whatsapp_number ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [lang, setLang] = useState<"en" | "pidgin">(me?.language_preference ?? "en");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function save(payload: { full_name?: string; whatsapp_number?: string; email?: string; language_preference?: "en" | "pidgin"; new_password?: string }) {
    setLoading(true);
    try {
      await fn({ data: payload });
      await invalidate();
      if (payload.new_password) setPassword("");
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
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Email (for password recovery)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            disabled={loading}
            onClick={() => save({ full_name: name, whatsapp_number: phone, email: email || undefined })}
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

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg">Password</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">New password</span>
            <div className="mt-1">
              <PasswordInput value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((s) => !s)} />
            </div>
          </label>
          <button
            disabled={loading || password.length < 8}
            onClick={() => save({ new_password: password })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Change password
          </button>
        </div>
      </section>

      <TransactionPinSection />
    </div>
  );
}

function TransactionPinSection() {
  const { data: me } = useMe();
  const fn = useServerFn(setTransactionPin);
  const resetFn = useServerFn(requestTransactionPinReset);
  const invalidate = useInvalidateMe();
  const has = !!me?.has_transaction_pin;
  const hasEmail = !!me?.email;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function save() {
    if (!/^\d{4}$/.test(next)) return toast.error("PIN must be exactly 4 digits");
    if (next !== confirm) return toast.error("PINs do not match");
    if (has && !/^\d{4}$/.test(current)) return toast.error("Enter your current 4-digit PIN");
    setLoading(true);
    try {
      await fn({ data: { new_pin: next, current_pin: has ? current : undefined } });
      await invalidate();
      setCurrent(""); setNext(""); setConfirm("");
      toast.success(has ? "PIN updated" : "Transaction PIN created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save PIN");
    } finally {
      setLoading(false);
    }
  }

  async function sendReset() {
    setResetLoading(true);
    try {
      const res = await resetFn();
      setSentTo(res.masked_email);
      toast.success("Reset link sent. Check your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg">Transaction PIN</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {has
          ? "Your 4-digit PIN is required to pay for laundry orders from your wallet."
          : "Create a 4-digit PIN. You'll be asked for it whenever you pay for a laundry order."}
      </p>
      <div className="mt-4 space-y-3 max-w-xs">
        {has && (
          <PinField label="Current PIN" value={current} onChange={setCurrent} />
        )}
        <PinField label={has ? "New PIN" : "Create PIN"} value={next} onChange={setNext} />
        <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} />
        <button
          disabled={loading}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Saving…" : has ? "Update PIN" : "Create PIN"}
        </button>
      </div>

      {has && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Forgot your PIN?</h3>
          {hasEmail ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a secure link to set a new PIN. The link expires in 30 minutes.
              </p>
              <button
                disabled={resetLoading}
                onClick={sendReset}
                className="mt-3 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {resetLoading ? "Sending…" : "Email me a reset link"}
              </button>
              {sentTo && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{sentTo}</span>. Check your inbox (and spam).
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Add an email in the Profile section above first — we need it to send you a reset link.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tracking-[0.5em] text-center"
        placeholder="••••"
      />
    </label>
  );
}
