import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Share2, Star } from "lucide-react";
import {
  getMyDisplayName,
  getProfessionalBySlug,
  PRO_CATEGORIES,
  submitReview,
} from "@/lib/professionals.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shop/$slug")({
  component: ShopPage,
});

function ShopPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => getProfessionalBySlug({ data: { slug } }),
  });
  const { data: me } = useQuery({
    queryKey: ["my-display-name"],
    queryFn: () => getMyDisplayName(),
  });

  // Book form state
  const [request, setRequest] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [location, setLocation] = useState("");

  // Review state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");

  const review = useMutation({
    mutationFn: () =>
      submitReview({ data: { professional_id: shop!.id, rating, comment } }),
    onSuccess: () => {
      toast.success("Thanks for your review!");
      setComment("");
      qc.invalidateQueries({ queryKey: ["shop", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!shop) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl">Shop not found</h1>
        <p className="text-sm text-muted-foreground">
          This shop may be inactive or the link may be wrong.
        </p>
      </div>
    );
  }

  const categoryLabel =
    PRO_CATEGORIES.find((c) => c.value === shop.category)?.label ?? shop.category;

  const CATEGORY_COPY: Record<
    string,
    { requestLabel: string; requestPlaceholder: string; locationPlaceholder: string; showSchedule: boolean }
  > = {
    hairdressing: {
      requestLabel: "Hairstyle you want (optional)",
      requestPlaceholder: "e.g. Knotless braids, medium size, waist length; bringing my own attachment",
      locationPlaceholder: "Where should the stylist meet you? (area / address)",
      showSchedule: true,
    },
    barbering: {
      requestLabel: "Haircut style you want (optional)",
      requestPlaceholder: "e.g. Low fade with line-up, beard trim",
      locationPlaceholder: "Where should the barber meet you? (area / address)",
      showSchedule: true,
    },
    hygiene: {
      requestLabel: "Products you need (optional)",
      requestPlaceholder: "e.g. 2 rolls tissue, 1 pack pads, 500ml hand sanitizer",
      locationPlaceholder: "Delivery address (area / street / landmark)",
      showSchedule: false,
    },
    gas_refill: {
      requestLabel: "Cylinder size & quantity (optional)",
      requestPlaceholder: "e.g. 12.5kg cylinder refill, 1 unit — pickup & return",
      locationPlaceholder: "Pickup address (area / street / landmark)",
      showSchedule: true,
    },
    accommodation: {
      requestLabel: "Stay details (optional)",
      requestPlaceholder: "e.g. 2 nights, 1 bedroom, 2 guests, check-in Fri evening",
      locationPlaceholder: "Preferred area / neighborhood",
      showSchedule: true,
    },
  };
  const copy =
    CATEGORY_COPY[shop.category] ?? {
      requestLabel: "Request (optional)",
      requestPlaceholder: "Tell the professional what you need",
      locationPlaceholder: "Your area / address",
      showSchedule: true,
    };

  const shopUrl =
    typeof window !== "undefined" ? `${window.location.origin}/shop/${shop.slug}` : "";

  const shopData = shop;
  const canContact = shopData.whatsapp_number.trim().length > 0;

  function contactProfessional() {
    if (!location.trim()) {
      toast.error("Please add your location — it's required.");
      return;
    }
    if (!canContact) {
      toast.error("This shop hasn't set a WhatsApp number yet.");
      return;
    }
    const username = me?.full_name?.trim() || "a FreshX customer";
    const number = shopData.whatsapp_number.replace(/[^0-9]/g, "");
    const lines = [
      `Hello ${shopData.business_name},`,
      ``,
      `My name is ${username}. I want to inquire about your service.`,
      `I am in ${location.trim()}.`,
    ];
    if (request.trim()) lines.push(``, `Request: ${request.trim()}`);
    if (schedDate.trim()) lines.push(`Preferred date: ${schedDate.trim()}`);
    if (schedTime.trim()) lines.push(`Preferred time: ${schedTime.trim()}`);
    lines.push(``, `(Sent via FreshX)`);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      {/* Header with logo */}
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={`${shop.business_name} logo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              No logo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-primary">{categoryLabel}</div>
          <h1 className="font-display text-3xl leading-tight">{shop.business_name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-primary text-primary" />
            {shop.review_count ? shop.avg_rating.toFixed(1) : "New"}
            {shop.review_count > 0 && <span>· {shop.review_count} reviews</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shopUrl);
                toast.success("Link copied");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: shop.business_name,
                      text: `Check out ${shop.business_name} on FreshX`,
                      url: shopUrl,
                    });
                  } else {
                    navigator.clipboard.writeText(shopUrl);
                    toast.success("Link copied");
                  }
                } catch {
                  /* noop */
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Book this service */}
      <section className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
        <h2 className="font-display text-xl">Book this service</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in what you need — location is required. Then contact {shop.business_name} on WhatsApp.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-muted-foreground">Request (optional)</span>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              placeholder="Anything you need — e.g. haircut style, gas cylinder size, hair type, dates for accommodation…"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted-foreground">Schedule date (optional)</span>
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Schedule time (optional)</span>
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-muted-foreground">
              Location <span className="text-destructive">*</span>
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Your area / address"
              required
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={contactProfessional}
          disabled={!canContact}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" /> Contact professional
        </button>
        {!canContact && (
          <p className="mt-2 text-xs text-destructive">
            This shop hasn't set a WhatsApp number yet.
          </p>
        )}
      </section>

      {/* Catalog */}
      {shop.items.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">What we offer</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shop.items.map((it) => (
              <div
                key={it.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-medium">{it.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{naira(it.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-display text-xl">Reviews</h2>

        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="text-sm font-medium">Leave a review</div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    n <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
          />
          <button
            onClick={() => review.mutate()}
            disabled={review.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {review.isPending ? "Submitting…" : "Submit review"}
          </button>
        </div>

        {shop.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {shop.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.reviewer_name}</div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
