export function naira(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length > 0) return `+234${digits}`;
  return "";
}

export function isValidNigerianPhone(input: string): boolean {
  const n = formatPhone(input);
  return /^\+234[789]\d{9}$/.test(n);
}
