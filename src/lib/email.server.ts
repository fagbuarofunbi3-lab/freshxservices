// Server-only email helper. Uses Resend HTTP API directly via fetch so it works
// reliably in the Cloudflare Worker runtime (no Node-only SDK).
// Never import from client code.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type ResendPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

async function sendViaResend(payload: ResendPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[email] resend error [${res.status}]: ${body}`);
    throw new Error(`Email provider error [${res.status}]: ${body || "unknown"}`);
  }
}

export type OrderEmailItem = { name: string; quantity: number; line_total: number };

export type OrderEmailPayload = {
  serviceType: "laundry" | "cleaning";
  orderRef: string;
  customerName: string;
  customerWhatsapp: string;
  items: OrderEmailItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  delivery?: string;
  address?: string | null;
  notes?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  spaceType?: string | null;
  recurring?: string | null;
  pricingNote?: string;
};

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function defaultFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "FreshX Services <noreply@freshxservices.com.ng>";
}

function renderOrderEmail(p: OrderEmailPayload): { subject: string; html: string; text: string } {
  const label = p.serviceType === "laundry" ? "Laundry" : "Cleaning";
  const subject = `New ${label} order — ${p.customerName} (${p.orderRef})`;

  const rowsHtml = p.items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${naira(i.line_total)}</td>
        </tr>`,
    )
    .join("");

  const lines: string[] = [];
  lines.push(`<p><strong>Customer:</strong> ${escapeHtml(p.customerName)}</p>`);
  lines.push(`<p><strong>WhatsApp:</strong> ${escapeHtml(p.customerWhatsapp)}</p>`);
  lines.push(`<p><strong>Service:</strong> ${label}</p>`);
  if (p.delivery) lines.push(`<p><strong>Delivery:</strong> ${escapeHtml(p.delivery)}</p>`);
  if (p.address) lines.push(`<p><strong>Address:</strong> ${escapeHtml(p.address)}</p>`);
  if (p.preferredDate) lines.push(`<p><strong>Preferred date:</strong> ${escapeHtml(p.preferredDate)}</p>`);
  if (p.preferredTime) lines.push(`<p><strong>Preferred time:</strong> ${escapeHtml(p.preferredTime)}</p>`);
  if (p.spaceType) lines.push(`<p><strong>Space:</strong> ${escapeHtml(p.spaceType)}</p>`);
  if (p.recurring) lines.push(`<p><strong>Frequency:</strong> ${escapeHtml(p.recurring)}</p>`);
  if (p.notes) lines.push(`<p><strong>Notes:</strong> ${escapeHtml(p.notes)}</p>`);

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 4px 0;color:#0f172a;">New ${label} order</h2>
        <p style="margin:0 0 16px 0;color:#64748b;font-size:12px;">Reference ${escapeHtml(p.orderRef)}</p>
        ${lines.join("")}
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:8px 10px;">Item</th>
              <th style="text-align:center;padding:8px 10px;">Qty</th>
              <th style="text-align:right;padding:8px 10px;">Line total</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <table style="width:100%;margin-top:12px;font-size:14px;">
          <tr><td>Subtotal</td><td style="text-align:right;">${naira(p.subtotal)}</td></tr>
          ${p.deliveryFee ? `<tr><td>Delivery</td><td style="text-align:right;">${naira(p.deliveryFee)}</td></tr>` : ""}
          ${p.discount ? `<tr><td>Discount</td><td style="text-align:right;">−${naira(p.discount)}</td></tr>` : ""}
          <tr><td style="padding-top:8px;font-weight:bold;">Total</td><td style="text-align:right;padding-top:8px;font-weight:bold;">${naira(p.total)}</td></tr>
        </table>
        ${p.pricingNote ? `<p style="margin-top:14px;padding:10px;background:#fef9c3;border-radius:8px;font-size:12px;color:#713f12;">${escapeHtml(p.pricingNote)}</p>` : ""}
        <p style="margin-top:18px;font-size:12px;color:#94a3b8;">FreshX Services — automated notification</p>
      </div>
    </div>`;

  const text = [
    `New ${label} order`,
    `Reference: ${p.orderRef}`,
    `Customer: ${p.customerName} (${p.customerWhatsapp})`,
    p.address ? `Address: ${p.address}` : "",
    "",
    "Items:",
    ...p.items.map((i) => `- ${i.name} × ${i.quantity} = ${naira(i.line_total)}`),
    "",
    `Subtotal: ${naira(p.subtotal)}`,
    p.deliveryFee ? `Delivery: ${naira(p.deliveryFee)}` : "",
    p.discount ? `Discount: -${naira(p.discount)}` : "",
    `Total: ${naira(p.total)}`,
    p.pricingNote ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export async function sendOrderEmailToOwner(payload: OrderEmailPayload): Promise<void> {
  const to = process.env.OWNER_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn("[email] OWNER_NOTIFICATION_EMAIL not set; skipping owner notification");
    return;
  }
  const { subject, html, text } = renderOrderEmail(payload);
  try {
    await sendViaResend({ from: defaultFrom(), to, subject, html, text });
  } catch (err) {
    console.error("[email] order email failed:", err);
  }
}

export async function sendPinResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const subject = "Reset your FreshX transaction PIN";
  const safeName = escapeHtml(params.name || "there");
  const safeUrl = escapeHtml(params.resetUrl);
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#0f172a;">Reset your transaction PIN</h2>
        <p style="color:#334155;font-size:14px;line-height:1.55;">Hi ${safeName},</p>
        <p style="color:#334155;font-size:14px;line-height:1.55;">
          We got a request to reset the 4-digit transaction PIN on your FreshX Services account.
          Click the button below to set a new PIN. This link expires in 30 minutes.
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Reset transaction PIN</a>
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.55;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <span style="word-break:break-all;color:#0f172a;">${safeUrl}</span>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:18px;">
          Didn't ask for this? You can safely ignore this email — your PIN won't change.
        </p>
      </div>
    </div>`;
  const text = `Hi ${params.name || "there"},

Reset your FreshX transaction PIN using this link (expires in 30 minutes):
${params.resetUrl}

If you didn't ask for this, ignore this email.`;
  try {
    await sendViaResend({ from: defaultFrom(), to: params.to, subject, html, text });
  } catch (err) {
    console.error("[email] pin reset failed:", err);
    throw new Error("Could not send the reset email. Please try again in a few minutes.");
  }
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const subject = "Reset your FreshX password";
  const safeName = escapeHtml(params.name || "there");
  const safeUrl = escapeHtml(params.resetUrl);
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#0f172a;">Reset your password</h2>
        <p style="color:#334155;font-size:14px;line-height:1.55;">Hi ${safeName},</p>
        <p style="color:#334155;font-size:14px;line-height:1.55;">
          We got a request to reset the password on your FreshX Services account.
          Click the button below to choose a new password. This link expires in 30 minutes.
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Reset password</a>
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.55;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <span style="word-break:break-all;color:#0f172a;">${safeUrl}</span>
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:18px;">
          Didn't ask for this? You can safely ignore this email — your password won't change.
        </p>
      </div>
    </div>`;
  const text = `Hi ${params.name || "there"},

Reset your FreshX password using this link (expires in 30 minutes):
${params.resetUrl}

If you didn't ask for this, ignore this email.`;
  try {
    await sendViaResend({ from: defaultFrom(), to: params.to, subject, html, text });
  } catch (err) {
    console.error("[email] password reset failed:", err);
    throw new Error("Could not send the password reset email. Please try again in a few minutes.");
  }
}
