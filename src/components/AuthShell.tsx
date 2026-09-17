import React from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--surface)]">
      <div
        className="freshx-blob"
        style={{
          background: "var(--color-primary)",
          width: 400,
          height: 400,
          top: -100,
          left: -100,
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 font-display text-2xl font-bold">
          Fresh<span className="text-primary">X</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl shadow-primary/5">
          <h1 className="font-display text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
        maxLength={200}
        type={show ? "text" : "password"}
        className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
