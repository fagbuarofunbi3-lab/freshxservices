import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { getMe } from "@/lib/auth.functions";

export type Me = Awaited<ReturnType<typeof getMe>>;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "FreshX Services" },
      {
        name: "description",
        content:
          "Premium laundry and cleaning in Nigeria. Drop your clothes, book a clean — FreshX handles the rest.",
      },
      { property: "og:title", content: "FreshX Services" },
      { property: "og:description", content: "Nigeria's No 1 Laundry and Cleaning Services for Nigerian Students" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#1A56DB" },
      { name: "twitter:title", content: "FreshX Services" },
      { name: "description", content: "Nigeria's No 1 Laundry and Cleaning Services for Nigerian Students" },
      { name: "twitter:description", content: "Nigeria's No 1 Laundry and Cleaning Services for Nigerian Students" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ded10f9b-73da-4496-9018-d69e75836647/id-preview-5b5ae2d8--62f7f722-642e-4bac-888b-a463493907b4.lovable.app-1779945321270.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ded10f9b-73da-4496-9018-d69e75836647/id-preview-5b5ae2d8--62f7f722-642e-4bac-888b-a463493907b4.lovable.app-1779945321270.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => getMe(), staleTime: 30_000 });
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl">404</h1>
        <p className="mt-2 text-muted-foreground">That page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  async function tryAgain() {
    await router.invalidate();
    reset();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">FreshX is getting your dashboard ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message === "Not signed in"
            ? "Your session is being refreshed. Try again or sign in once more."
            : "Please try again. If it continues, sign in again and FreshX will take you to your dashboard."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={tryAgain} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
            Try again
          </button>
          <Link to="/login" className="rounded-md border border-border bg-card px-4 py-2 text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
