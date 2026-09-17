import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { motion } from "framer-motion";
import { GraduationCap, Ticket, Shirt, Compass, Users, MessageCircle, CheckCircle2 } from "lucide-react";
import { getMe, isAdminRole } from "@/lib/auth.functions";
import { getContactWhatsapp } from "@/lib/site-settings.functions";
import { useMe } from "../__root";

export const Route = createFileRoute("/_authenticated/ambassador")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me) throw redirect({ to: "/login" });
    if (isAdminRole(me.role)) throw redirect({ to: "/admin" });
  },
  component: AmbassadorPage,
});

const BENEFITS = [
  { icon: Ticket, t: "Special promo code", d: "Get your own unique promo code and earn endlessly." },
  { icon: Shirt, t: "Branded merch", d: "Free FreshX T-shirt and cap to rep the brand." },
  { icon: Compass, t: "Free orientation", d: "Get fully onboarded on what FreshX is all about." },
  { icon: Users, t: "Innovative community", d: "Be part of a fast-growing community of innovators." },
] as const;

const DUTIES = [
  "Share your unique promo code with friends, family and followers.",
  "Increase awareness and visibility of the FreshX brand.",
  "Represent FreshX everywhere, anytime.",
  "Use your promo code for consistent earnings.",
  "Ensure active sign-ups and usage of the FreshX website.",
  "Engage with potential customers around your campus.",
] as const;

function AmbassadorPage() {
  const { data: me } = useMe();
  const getContact = useServerFn(getContactWhatsapp);
  const { data: contact } = useQuery({
    queryKey: ["contact-whatsapp"],
    queryFn: () => getContact({}),
  });
  const whatsappNumber = contact?.number ?? "2348132589218";

  const message = `Hello FreshX, my name is ${me?.full_name ?? ""}. I am applying to be a Campus Ambassador. I want to pay my ₦20,000 one-time fee. Please guide me on the next steps.`;
  const applyUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground"
      >
        <div className="freshx-blob" style={{ background: "white", width: 240, height: 240, top: -80, right: -60, opacity: 0.15 }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <GraduationCap className="h-3.5 w-3.5" /> Campus Ambassador
          </div>
          <h1 className="mt-4 font-display text-3xl md:text-4xl">Become an Ambassador for FreshX</h1>
          <p className="mt-2 max-w-xl text-sm text-white/90 md:text-base">
            Rep the brand on your campus, share your promo code, and earn endlessly.
          </p>
        </div>
      </motion.section>

      <section>
        <h2 className="font-display text-2xl">Benefits</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.t} className="rounded-2xl border border-border bg-card p-5">
              <b.icon className="h-6 w-6 text-primary" />
              <div className="mt-3 font-medium">{b.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">Your duties</h2>
        <ul className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-5">
          {DUTIES.map((d) => (
            <li key={d} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary-soft p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Apply now</div>
        <h2 className="mt-1 font-display text-2xl">One-time fee of ₦20,000</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This covers your branded T-shirt, cap, onboarding orientation and other ambassador benefits. Once paid, you're officially in.
        </p>
        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Apply on WhatsApp
        </a>
      </section>
    </div>
  );
}
