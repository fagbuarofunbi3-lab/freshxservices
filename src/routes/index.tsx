import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/create-fn";
import { motion } from "framer-motion";
import { Sparkles, Wallet, MessageCircle, Truck, ShieldCheck, ArrowRight, Phone, Video } from "lucide-react";
import { getContactWhatsapp, getSiteMedia } from "@/lib/site-settings.functions";

const SITE = "https://freshxservices.com.ng";
const HOME_TITLE = "FreshX Services — Laundry & Cleaning in Port Harcourt";
const HOME_DESC =
  "FreshX is an automated laundry, dry cleaning and home cleaning service in Port Harcourt, Nigeria. Book a pickup online, pay from your wallet, and get fresh clothes delivered back to you.";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE}/#website`,
              url: `${SITE}/`,
              name: "FreshX Services",
              inLanguage: "en-NG",
              publisher: { "@id": `${SITE}/#business` },
            },
            {
              "@type": "LocalBusiness",
              "@id": `${SITE}/#business`,
              name: "FreshX Services",
              url: `${SITE}/`,
              description: HOME_DESC,
              image: `${SITE}/favicon.ico`,
              priceRange: "₦₦",
              areaServed: { "@type": "City", name: "Port Harcourt" },
              address: {
                "@type": "PostalAddress",
                addressLocality: "Port Harcourt",
                addressRegion: "Rivers",
                addressCountry: "NG",
              },
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ],
                  opens: "08:00",
                  closes: "20:00",
                },
              ],
              makesOffer: [
                "Laundry pickup and delivery",
                "Dry cleaning",
                "Home and office cleaning",
                "Cooking gas refill",
                "Barbing and hairdressing",
              ].map((name) => ({
                "@type": "Offer",
                itemOffered: { "@type": "Service", name, areaServed: "Port Harcourt, Nigeria" },
              })),
            },
          ],
        }),
      },
    ],
  }),
});

function Landing() {
  const getContact = useServerFn(getContactWhatsapp);
  const getMedia = useServerFn(getSiteMedia);
  const { data: contact } = useQuery({
    queryKey: ["contact-whatsapp"],
    queryFn: () => getContact({}),
  });
  const { data: media } = useQuery({
    queryKey: ["site-media"],
    queryFn: () => getMedia({}),
  });
  const contactNumber = contact?.number ?? "2348132589218";
  const videoUrl = media?.video_url ?? "";
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight">
            Fresh<span className="text-primary">X</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how">How it works</a>
            <a href="#services">Services</a>
            <a href="#why">Why FreshX</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-28">
          <div>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Laundry & Cleaning. <span className="text-primary">Done Fresh.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-foreground/80">
              Drop your clothes, book a clean — FreshX handles the rest. Pre-paid wallet, real-time tracking, and updates straight to your WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center rounded-md border border-border bg-background px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Floating card mockup */}
          <div className="relative mx-auto w-full max-w-sm space-y-4">
            {/* Promo video billboard — shown to everyone; blank if admin hasn't set one */}
            <PromoVideo url={videoUrl} />

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="glass rounded-2xl p-5 shadow-2xl shadow-primary/10"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Available balance
              </div>
              <div className="mt-1 font-display text-4xl font-bold">₦2,500.00</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground">
                  Top Up
                </div>
                <div className="rounded-md border border-border px-3 py-2 text-center text-xs font-medium">
                  Transactions
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-border p-3">
                <div className="text-xs text-muted-foreground">Order FX-00123 · Laundry</div>
                <div className="mt-2 flex items-center gap-2">
                  {["Received", "Washing", "Ready", "Delivered"].map((s, i) => (
                    <div key={s} className="flex-1">
                      <div
                        className={`h-1.5 rounded-full ${i <= 1 ? "bg-primary" : "bg-border"}`}
                      />
                      <div className="mt-1 text-[10px] text-muted-foreground">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-[color:var(--surface)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl md:text-4xl">How it works</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">Three steps to fresh.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: 1, t: "Create an account", d: "Sign up with your name and WhatsApp number." },
              { n: 2, t: "Fund your wallet", d: "Top up from ₦500 — card, bank transfer, or USSD." },
              { n: 3, t: "Place your order", d: "Pick laundry or cleaning, pick your items, submit." },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
                  {s.n}
                </div>
                <h3 className="mt-4 text-xl">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl md:text-4xl">Two services. One wallet.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <ServiceCard
              icon={<Sparkles className="h-6 w-6 text-primary" />}
              title="Laundry"
              copy="Wash & fold your soft clothes, hard clothes, and bedding."
              price="from ₦150/item"
              cta="Order Now"
            />
            <ServiceCard
              icon={<ShieldCheck className="h-6 w-6 text-primary" />}
              title="Cleaning"
              copy="Deep clean your apartment, office, shop or institution."
              price="from ₦3,500/session"
              cta="Book Now"
            />
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" className="bg-[color:var(--surface)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl md:text-4xl">Why FreshX</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Sparkles, t: "Real-time tracking", d: "Watch every order from received to delivered." },
              { icon: Wallet, t: "Pre-paid wallet", d: "No cash, no card-swiping at every order." },
              { icon: MessageCircle, t: "WhatsApp updates", d: "We message you at every step." },
              { icon: Truck, t: "Pickup or drop-off", d: "Bring it yourself or we come to you." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-card p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 text-lg">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="font-display text-xl">
            Fresh<span className="text-primary">X</span>
            <span className="ml-3 text-xs font-normal text-muted-foreground">
              Fresh clothes, clean spaces, zero stress.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href="https://wa.me/2348132589218"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href="https://www.instagram.com/freshx_services"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              Instagram @freshx_services
            </a>
            <a
              href="https://www.tiktok.com/@freshx.services"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              TikTok @freshx.services
            </a>
            <a
              href={`https://wa.me/${contactNumber}?text=${encodeURIComponent("Hello FreshX, I'd like to get in touch.")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Phone className="h-4 w-4" /> Contact us
            </a>
          </div>
          <div className="text-xs text-muted-foreground">© 2025 FreshX Services</div>
        </div>
      </footer>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  copy,
  price,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  price: string;
  cta: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group rounded-2xl border border-border bg-card p-8 transition hover:border-primary hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft">{icon}</div>
      <h3 className="mt-5 font-display text-2xl">{title}</h3>
      <p className="mt-2 text-muted-foreground">{copy}</p>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm font-medium text-primary">{price}</span>
        <Link
          to="/signup"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition group-hover:opacity-90"
        >
          {cta}
        </Link>
      </div>
    </motion.div>
  );
}


function PromoVideo({ url }: { url: string }) {
  const trimmed = url.trim();
  const yt = toYouTubeEmbed(trimmed);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-xl shadow-primary/10">
      <div className="aspect-video w-full bg-[color:var(--surface)]">
        {yt ? (
          <iframe
            src={yt}
            title="FreshX promo video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : trimmed ? (
          <video
            src={trimmed}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="h-8 w-8" />
            <div className="text-xs">Promo video coming soon</div>
          </div>
        )}
      </div>
    </div>
  );
}

function toYouTubeEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
  } catch {
    return null;
  }
  return null;
}

