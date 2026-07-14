import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Star } from "lucide-react";
import {
  getProfessionalBySlug,
  PRO_CATEGORIES,
  submitReview,
} from "@/lib/professionals.functions";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shop/$slug")({
  component: ShopPage,
});

type ShopItem = { id: string; image_url: string; title: string; price: number };

function ShopPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => getProfessionalBySlug({ data: { slug } }),
  });

  const [bookingItem, setBookingItem] = useState<ShopItem | null>(null);
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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">{categoryLabel}</div>
        <h1 className="font-display text-3xl">{shop.business_name}</h1>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-4 w-4 fill-primary text-primary" />
          {shop.review_count ? shop.avg_rating.toFixed(1) : "New"}
          {shop.review_count > 0 && <span>· {shop.review_count} reviews</span>}
        </div>
      </div>

      {shop.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This shop hasn't added items yet.
        </div>
      ) : (
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
                <button
                  onClick={() => setBookingItem(it)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <MessageCircle className="h-4 w-4" /> Book
                </button>
              </div>
            </div>
          ))}
        </div>
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

      {bookingItem && (
        <BookModal
          item={bookingItem}
          shopName={shop.business_name}
          whatsapp={shop.whatsapp_number}
          onClose={() => setBookingItem(null)}
        />
      )}
    </div>
  );
}

function BookModal({
  item,
  shopName,
  whatsapp,
  onClose,
}: {
  item: ShopItem;
  shopName: string;
  whatsapp: string;
  onClose: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [location, setLocation] = useState("");

  const canSend = whatsapp.trim().length > 0;

  function send() {
    const number = whatsapp.replace(/[^0-9]/g, "");
    const message = [
      `Hi ${shopName}, I'd like to book:`,
      `• ${item.title} — ${naira(item.price)}`,
      instructions ? `\nInstructions: ${instructions}` : "",
      location ? `Location: ${location}` : "",
      `\n(Sent via FreshX)`,
    ]
      .filter(Boolean)
      .join("\n");
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl">
        <h3 className="font-display text-xl">Book: {item.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Send your booking to {shopName} on WhatsApp.
        </p>

        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-muted-foreground">Special instructions</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Preferred time, color, size"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-muted-foreground">Location / address</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where should we deliver / meet?"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        {!canSend && (
          <p className="mt-3 text-xs text-destructive">
            This shop hasn't set a WhatsApp number yet.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!canSend}
            onClick={send}
            className="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" /> Send on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
