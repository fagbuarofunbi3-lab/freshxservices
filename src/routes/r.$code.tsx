import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Truck, WashingMachine } from "lucide-react";

export const Route = createFileRoute("/r/$code")({
  head: ({ params }) => {
    const code = (params.code ?? "").toUpperCase();
    const title = `Join FreshX — invited with code ${code}`;
    const description =
      "FreshX delivers premium laundry & cleaning across Port Harcourt. Sign up with your friend's referral code and get started in minutes.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ReferralLanding,
});

function ReferralLanding() {
  const { code } = Route.useParams();
  const clean = (code ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--surface)]">
      <div
        className="freshx-blob"
        style={{ background: "var(--color-primary)", width: 420, height: 420, top: -140, right: -140 }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-10">
        <header>
          <Link to="/" className="font-display text-2xl font-bold">
            Fresh<span className="text-primary">X</span>
          </Link>
        </header>

        <main className="mt-8 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            You've been invited
          </div>

          <h1 className="font-display text-3xl leading-tight md:text-4xl">
            Fresh laundry & cleaning, delivered to your door.
          </h1>
          <p className="text-sm text-muted-foreground">
            Your friend shared their FreshX referral code with you. Sign up in less than a minute and book your first order — pickup and drop-off included across Port Harcourt.
          </p>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Referral code
            </div>
            <div className="mt-1 font-mono text-2xl tracking-widest">{clean || "—"}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              We'll apply it automatically when you sign up.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            <Feature icon={<WashingMachine className="h-4 w-4" />} text="Wash, iron & fold laundry" />
            <Feature icon={<Truck className="h-4 w-4" />} text="Free pickup & delivery" />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} text="Trusted by hundreds in Port Harcourt" />
          </ul>

          <Link
            to="/signup"
            search={{ ref: clean } as never}
            className="block w-full rounded-md bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Sign up on FreshX
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </main>

        <footer className="mt-10 text-center text-[11px] text-muted-foreground">
          FreshX Services · Port Harcourt
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}
