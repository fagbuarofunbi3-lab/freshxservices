import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteProfessional,
  adminListProfessionals,
  adminPromoteProfessional,
  PRO_CATEGORIES,
} from "@/lib/professionals.functions";
import { adminListCustomers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/professionals")({
  component: AdminProfessionals,
});

function AdminProfessionals() {
  const qc = useQueryClient();
  const { data: pros } = useQuery({
    queryKey: ["admin-professionals"],
    queryFn: () => adminListProfessionals(),
  });
  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => adminListCustomers(),
  });

  const [customerId, setCustomerId] = useState("");
  const [category, setCategory] = useState<(typeof PRO_CATEGORIES)[number]["value"]>(
    "hairdressing",
  );
  const [businessName, setBusinessName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const promote = useMutation({
    mutationFn: () =>
      adminPromoteProfessional({
        data: {
          profile_id: customerId,
          category,
          business_name: businessName,
          whatsapp_number: whatsapp,
        },
      }),
    onSuccess: () => {
      toast.success("Promoted to professional");
      setCustomerId("");
      setBusinessName("");
      setWhatsapp("");
      qc.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminDeleteProfessional({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-professionals"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoted = useMemo(
    () => new Set((pros ?? []).map((p) => p.profile_id)),
    [pros],
  );
  const eligible = (customers ?? []).filter((c) => !promoted.has(c.id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl">FreshX Professionals</h2>
        <p className="text-xs text-muted-foreground">
          Promote a customer so they can list their business (hairdresser, barber, hygiene,
          gas refill, accommodation).
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Promote a customer
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Customer</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">— Select —</option>
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {c.whatsapp_number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as (typeof PRO_CATEGORIES)[number]["value"])
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            >
              {PRO_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted-foreground">Business name</span>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="e.g. Funbi Cuts"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted-foreground">WhatsApp number (optional)</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. 2348012345678"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
        <button
          disabled={promote.isPending || !customerId || businessName.trim().length < 2}
          onClick={() => promote.mutate()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {promote.isPending ? "Promoting…" : "Promote to Professional"}
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Current professionals
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(pros ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{p.business_name}</td>
                  <td className="px-4 py-3">{p.owner_name}</td>
                  <td className="px-4 py-3">
                    {PRO_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">/shop/{p.slug}</td>
                  <td className="px-4 py-3">{p.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${p.business_name}?`)) remove.mutate(p.id);
                      }}
                      className="text-sm text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {(pros ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No professionals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
