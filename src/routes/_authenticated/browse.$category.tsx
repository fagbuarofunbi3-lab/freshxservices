import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import {
  listProfessionalsByCategory,
  PRO_CATEGORIES,
} from "@/lib/professionals.functions";
import { naira } from "@/lib/format";

const CATEGORY_VALUES = PRO_CATEGORIES.map((c) => c.value);
type CategoryValue = (typeof PRO_CATEGORIES)[number]["value"];

export const Route = createFileRoute("/_authenticated/browse/$category")({
  component: BrowsePage,
});

function BrowsePage() {
  const { category } = Route.useParams();
  const isValid = (CATEGORY_VALUES as readonly string[]).includes(category);
  const label = PRO_CATEGORIES.find((c) => c.value === category)?.label ?? category;

  const { data, isLoading } = useQuery({
    queryKey: ["browse-category", category],
    enabled: isValid,
    queryFn: () =>
      listProfessionalsByCategory({ data: { category: category as CategoryValue } }),
  });

  if (!isValid) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl">Unknown category</h1>
        <Link to="/order/new" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to services
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wider text-primary">FreshX Professionals</div>
        <h1 className="font-display text-3xl">{label}</h1>
        <p className="text-sm text-muted-foreground">
          Vetted professionals in your area. Tap any shop to view items and book.
        </p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No professionals in this category yet. Check back soon.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((p) => (
          <Link
            key={p.id}
            to="/shop/$slug"
            params={{ slug: p.slug }}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              {p.cover_image ? (
                <img
                  src={p.cover_image}
                  alt={p.business_name}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="font-display text-lg leading-tight">{p.business_name}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                {p.review_count ? p.avg_rating.toFixed(1) : "New"}
                {p.review_count > 0 && <span>· {p.review_count} reviews</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {/* naira is imported for future price teasers; suppress unused warning */}
      <span className="hidden">{naira(0)}</span>
    </div>
  );
}
