import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@/lib/create-fn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Lock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Globe,
  CheckCircle2,
  ArrowRight,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import {
  updateProfile,
  sendSecurityOTP,
  changePasswordWithOTP,
  setTransactionPinWithOTP,
  deleteTransactionPinWithOTP,
} from "@/lib/auth.functions";
import { useMe, useInvalidateMe } from "../__root";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type TabType = "profile" | "password" | "pin";

type SettingsSearch = {
  tab?: TabType;
  action?: "create" | "change" | "delete";
};

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: (search.tab as TabType) || undefined,
    action: (search.action as SettingsSearch["action"]) || undefined,
  }),
  component: SettingsPage,
});

function maskEmail(email?: string | null) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

function SettingsPage() {
  const { data: me } = useMe();
  const invalidate = useInvalidateMe();
  const updateProfileFn = useServerFn(updateProfile);
  const search = Route.useSearch();

  const [activeTab, setActiveTab] = useState<TabType>(search.tab || "profile");

  useEffect(() => {
    if (search.tab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  // Profile form state
  const [name, setName] = useState(me?.full_name ?? "");
  const [phone, setPhone] = useState(me?.whatsapp_number ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [lang, setLang] = useState<"en" | "pidgin">(me?.language_preference ?? "en");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.full_name ?? "");
      setPhone(me.whatsapp_number ?? "");
      setEmail(me.email ?? "");
      setLang(me.language_preference ?? "en");
    }
  }, [me]);

  async function handleSaveProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfileFn({
        data: {
          full_name: name.trim(),
          whatsapp_number: phone.trim(),
          email: hasEmail ? undefined : (email.trim() || undefined),
          language_preference: lang,
        },
      });
      await invalidate();
      toast.success("Profile saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  const hasEmail = Boolean(me?.email && me.email.includes("@"));

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Account Management
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal profile, communication preferences, and security credentials.
          </p>
        </div>

        {/* User Summary Pill */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
            {me?.full_name ? me.full_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold leading-tight">{me?.full_name || "Account User"}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="capitalize">{me?.role || "Customer"}</span>
              <span>·</span>
              {hasEmail ? (
                <span className="flex items-center gap-0.5 text-emerald-500 font-medium">
                  <ShieldCheck className="h-3 w-3" /> Email Secured
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                  <AlertTriangle className="h-3 w-3" /> Add Email
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-border pb-px gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" /> Profile & Language
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "password"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-4 w-4" /> Password Security
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pin")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "pin"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="h-4 w-4" /> Transaction PIN
        </button>
      </div>

      {/* Security notice if email is missing */}
      {!hasEmail && activeTab !== "profile" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Email address required for security actions</div>
            <p className="text-xs text-muted-foreground">
              To verify password changes, PIN creation, or PIN deletion, you need a verified email address on file.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className="mt-2 text-xs font-semibold text-primary underline hover:opacity-80"
            >
              Add your email in Profile →
            </button>
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Profile Info Form */}
            <form onSubmit={handleSaveProfile} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">Personal Information</h2>
                  <p className="text-xs text-muted-foreground">Update your contact information and identity.</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <User className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Full name
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Adeleke Olamide"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    WhatsApp Number
                  </label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. 08012345678"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email address (Primary Account Identifier)
                    </label>
                    {hasEmail ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Lock className="h-3 w-3" /> Primary (Immutable)
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-500">
                        Add primary email
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      readOnly={hasEmail}
                      disabled={hasEmail}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(
                        "w-full rounded-lg border border-input pl-10 pr-10 py-2.5 text-sm outline-none transition",
                        hasEmail
                          ? "cursor-not-allowed bg-muted/60 text-muted-foreground font-medium shadow-none select-none"
                          : "bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                      )}
                      placeholder="you@example.com"
                    />
                    {hasEmail && (
                      <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {hasEmail
                      ? "Your email address is your permanent primary account identifier and cannot be changed. All security codes (OTPs) for password changes and PIN settings are routed here."
                      : "We use this email to send one-time codes (OTPs) when you change your password, create, or delete a transaction PIN."}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {savingProfile ? "Saving changes…" : "Save profile"}
                </button>
              </div>
            </form>

            {/* Language Preferences Card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">Language & Regional Preferences</h2>
                  <p className="text-xs text-muted-foreground">Select your preferred app display language.</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Globe className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {[
                  { id: "en" as const, label: "English", desc: "Standard English language interface" },
                  { id: "pidgin" as const, label: "Nigerian Pidgin", desc: "Naija Pidgin English interface" },
                ].map((item) => {
                  const isSelected = lang === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLang(item.id);
                        handleSaveProfile();
                      }}
                      className={`flex flex-1 min-w-[240px] items-center justify-between rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-foreground">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.desc}</div>
                      </div>
                      {isSelected && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "password" && (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <PasswordSecurityCard email={me?.email} />
          </motion.div>
        )}

        {activeTab === "pin" && (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <TransactionPinSecurityCard
              hasPin={Boolean(me?.has_transaction_pin)}
              email={me?.email}
              onPinUpdated={invalidate}
              initialMode={search.action === "create" ? "create" : "idle"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
 * 1. PASSWORD SECURITY CARD WITH EMAIL OTP VERIFICATION
 * ========================================================================= */
function PasswordSecurityCard({ email }: { email?: string | null }) {
  const sendOTPFn = useServerFn(sendSecurityOTP);
  const changePasswordFn = useServerFn(changePasswordWithOTP);

  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOTP, setSendingOTP] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const hasEmail = Boolean(email && email.includes("@"));

  async function handleSendOTP() {
    if (!hasEmail || !email) {
      toast.error("Please add and save an email address in Profile first.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }

    setSendingOTP(true);
    try {
      await sendOTPFn({
        data: { email, purpose: "change_password" },
      });
      setStep("otp");
      setCooldown(60);
      toast.success(`Verification code sent to ${maskEmail(email)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setSendingOTP(false);
    }
  }

  async function handleVerifyAndSubmit(codeToVerify?: string) {
    const code = (codeToVerify || otp).trim();
    if (code.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code");
      return;
    }

    setSubmitting(true);
    try {
      await changePasswordFn({
        data: {
          new_password: newPassword,
          otp: code,
        },
      });
      toast.success("Password changed successfully! You can now use your new password.");
      setIsEditing(false);
      setStep("form");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Password & Authentication</h2>
          <p className="text-xs text-muted-foreground">
            Keep your account secure with email OTP-verified password changes.
          </p>
        </div>
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Lock className="h-5 w-5" />
        </div>
      </div>

      {/* Password Status Card */}
      {!isEditing && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Account Password is Active</div>
              <div className="text-xs text-muted-foreground">
                All password changes require a 6-digit one-time code sent to your email.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={!hasEmail}
            onClick={() => {
              setIsEditing(true);
              setStep("form");
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Change password
          </button>
        </div>
      )}

      {/* Change Password Flow */}
      {isEditing && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {step === "form" ? "Enter your new password" : "Enter 6-digit email verification code"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "form"
                  ? "Create a strong password with at least 8 characters."
                  : `We sent a security code to ${maskEmail(email)}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setStep("form");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          {step === "form" && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  New Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Confirm New Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={sendingOTP || newPassword.length < 8 || newPassword !== confirmPassword}
                  onClick={handleSendOTP}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {sendingOTP ? "Sending code…" : "Send verification code →"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-5 max-w-md">
              <div className="flex flex-col items-center justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => {
                    const digits = val.replace(/\D/g, "");
                    setOtp(digits);
                    if (digits.length === 6) {
                      handleVerifyAndSubmit(digits);
                    }
                  }}
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <InputOTPSlot key={idx} index={idx} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Didn't receive the code?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || sendingOTP}
                  onClick={handleSendOTP}
                  className="font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting || otp.length !== 6}
                  onClick={() => handleVerifyAndSubmit()}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Updating password…" : "Confirm password change"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * 2. TRANSACTION PIN SECURITY CARD WITH EMAIL OTP VERIFICATION
 * ========================================================================= */
function TransactionPinSecurityCard({
  hasPin,
  email,
  onPinUpdated,
  initialMode = "idle",
}: {
  hasPin: boolean;
  email?: string | null;
  onPinUpdated: () => Promise<void>;
  initialMode?: "idle" | "create" | "delete";
}) {
  const sendOTPFn = useServerFn(sendSecurityOTP);
  const setPinFn = useServerFn(setTransactionPinWithOTP);
  const deletePinFn = useServerFn(deleteTransactionPinWithOTP);

  const [mode, setMode] = useState<"idle" | "create" | "delete">(initialMode);
  const [pinStep, setPinStep] = useState<"form" | "otp">("form");

  useEffect(() => {
    if (initialMode && initialMode !== "idle") {
      setMode(initialMode);
      setPinStep("form");
    }
  }, [initialMode]);

  // Create/Update PIN state
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");

  // Delete PIN state
  const [deleteOtp, setDeleteOtp] = useState("");

  const [sendingOTP, setSendingOTP] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const hasEmail = Boolean(email && email.includes("@"));

  // Send OTP for creating / updating PIN
  async function handleSendCreatePinOTP() {
    if (!hasEmail || !email) {
      toast.error("Please add and save an email address in Profile first.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match. Please re-enter.");
      return;
    }

    setSendingOTP(true);
    try {
      await sendOTPFn({
        data: { email, purpose: "create_pin" },
      });
      setPinStep("otp");
      setCooldown(60);
      toast.success(`Verification code sent to ${maskEmail(email)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setSendingOTP(false);
    }
  }

  // Submit Create / Update PIN
  async function handleConfirmCreatePin(codeToVerify?: string) {
    const code = (codeToVerify || otp).trim();
    if (code.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code");
      return;
    }

    setSubmitting(true);
    try {
      await setPinFn({
        data: {
          new_pin: newPin,
          otp: code,
        },
      });
      await onPinUpdated();
      toast.success(hasPin ? "Transaction PIN updated successfully!" : "Transaction PIN created successfully!");
      setMode("idle");
      setPinStep("form");
      setNewPin("");
      setConfirmPin("");
      setOtp("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set transaction PIN");
    } finally {
      setSubmitting(false);
    }
  }

  // Send OTP for deleting PIN
  async function handleSendDeletePinOTP() {
    if (!hasEmail || !email) {
      toast.error("Please add and save an email address in Profile first.");
      return;
    }

    setSendingOTP(true);
    try {
      await sendOTPFn({
        data: { email, purpose: "delete_pin" },
      });
      setPinStep("otp");
      setCooldown(60);
      toast.success(`Security deletion code sent to ${maskEmail(email)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSendingOTP(false);
    }
  }

  // Confirm Delete PIN
  async function handleConfirmDeletePin(codeToVerify?: string) {
    const code = (codeToVerify || deleteOtp).trim();
    if (code.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code");
      return;
    }

    setSubmitting(true);
    try {
      await deletePinFn({
        data: { otp: code },
      });
      await onPinUpdated();
      toast.success("Transaction PIN removed from your account.");
      setMode("idle");
      setPinStep("form");
      setDeleteOtp("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete transaction PIN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Wallet Transaction PIN</h2>
          <p className="text-xs text-muted-foreground">
            A 4-digit numeric code required to authorize payments from your wallet balance.
          </p>
        </div>
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
      </div>

      {/* Current Status Card */}
      {mode === "idle" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                hasPin ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              }`}
            >
              {hasPin ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {hasPin ? "Transaction PIN is Active" : "No Transaction PIN Configured"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    hasPin
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {hasPin ? "Protected" : "Unset"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {hasPin
                  ? "Your 4-digit PIN secures all wallet debit transactions and service bookings."
                  : "Create a 4-digit PIN to prevent unauthorized payments from your wallet balance."}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasEmail}
              onClick={() => {
                setMode("create");
                setPinStep("form");
                setNewPin("");
                setConfirmPin("");
                setOtp("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {hasPin ? "Change PIN" : "Create PIN"}
            </button>

            {hasPin && (
              <button
                type="button"
                disabled={!hasEmail}
                onClick={() => {
                  setMode("delete");
                  setPinStep("form");
                  setDeleteOtp("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Remove PIN
              </button>
            )}
          </div>
        </div>
      )}

      {/* CREATE / UPDATE PIN FLOW */}
      {mode === "create" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {pinStep === "form"
                  ? hasPin
                    ? "Set your new 4-digit transaction PIN"
                    : "Create your 4-digit transaction PIN"
                  : "Verify with email code"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pinStep === "form"
                  ? "Choose 4 digits that are easy for you to remember but difficult for others to guess."
                  : `Enter the 6-digit verification code sent to ${maskEmail(email)}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setPinStep("form");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          {pinStep === "form" && (
            <div className="space-y-5 max-w-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {hasPin ? "New 4-Digit PIN" : "Enter 4-Digit PIN"}
                </label>
                <div className="flex justify-start">
                  <InputOTP
                    maxLength={4}
                    value={newPin}
                    onChange={(val) => setNewPin(val.replace(/\D/g, "").slice(0, 4))}
                  >
                    <InputOTPGroup className="gap-2 sm:gap-3">
                      {[0, 1, 2, 3].map((idx) => (
                        <InputOTPSlot key={idx} index={idx} mask />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Confirm 4-Digit PIN
                </label>
                <div className="flex justify-start">
                  <InputOTP
                    maxLength={4}
                    value={confirmPin}
                    onChange={(val) => setConfirmPin(val.replace(/\D/g, "").slice(0, 4))}
                  >
                    <InputOTPGroup className="gap-2 sm:gap-3">
                      {[0, 1, 2, 3].map((idx) => (
                        <InputOTPSlot key={idx} index={idx} mask />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={sendingOTP || newPin.length !== 4 || newPin !== confirmPin}
                  onClick={handleSendCreatePinOTP}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {sendingOTP ? "Sending code…" : "Send verification code →"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("idle")}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pinStep === "otp" && (
            <div className="space-y-5 max-w-md">
              <div className="flex flex-col items-center justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => {
                    const digits = val.replace(/\D/g, "");
                    setOtp(digits);
                    if (digits.length === 6) {
                      handleConfirmCreatePin(digits);
                    }
                  }}
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <InputOTPSlot key={idx} index={idx} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Didn't receive the code?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || sendingOTP}
                  onClick={handleSendCreatePinOTP}
                  className="font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting || otp.length !== 6}
                  onClick={() => handleConfirmCreatePin()}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Verifying & setting PIN…" : "Confirm PIN creation"}
                </button>
                <button
                  type="button"
                  onClick={() => setPinStep("form")}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELETE PIN FLOW */}
      {mode === "delete" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Remove Transaction PIN
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pinStep === "form"
                  ? "Are you sure you want to remove your transaction PIN? Wallet payments will no longer be protected by a PIN."
                  : `Enter the 6-digit confirmation code sent to ${maskEmail(email)} to remove your PIN.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setPinStep("form");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          {pinStep === "form" && (
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                disabled={sendingOTP}
                onClick={handleSendDeletePinOTP}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {sendingOTP ? "Sending deletion code…" : "Send verification code to remove PIN →"}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Keep my PIN
              </button>
            </div>
          )}

          {pinStep === "otp" && (
            <div className="space-y-5 max-w-md">
              <div className="flex flex-col items-center justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(val) => {
                    const digits = val.replace(/\D/g, "");
                    setDeleteOtp(digits);
                    if (digits.length === 6) {
                      handleConfirmDeletePin(digits);
                    }
                  }}
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <InputOTPSlot key={idx} index={idx} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Didn't receive the code?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || sendingOTP}
                  onClick={handleSendDeletePinOTP}
                  className="font-medium text-destructive hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting || deleteOtp.length !== 6}
                  onClick={() => handleConfirmDeletePin()}
                  className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Deleting PIN…" : "Confirm PIN Deletion"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("idle")}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
