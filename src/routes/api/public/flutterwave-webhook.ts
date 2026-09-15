import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const backendUrl =
          (process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || "http://localhost:8080").replace(/\/+$/, "");

        const url = `${backendUrl}/api/public/flutterwave-webhook`;
        const headers = new Headers(request.headers);

        const body = await request.text();
        const res = await fetch(url, {
          method: "POST",
          headers,
          body,
        });

        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { "Content-Type": res.headers.get("content-type") || "text/plain" },
        });
      },
    },
  },
});
