import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { getMe } from "@/lib/auth.functions";

export type Me = Awaited<ReturnType<typeof getMe>>;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

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

function ErrorView({ error, reset }: { error: any; reset: () => void }) {
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
