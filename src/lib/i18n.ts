export type Lang = "en" | "pidgin";

export const STRINGS = {
  en: {
    place_order: "Place Order",
    wallet_balance: "Available balance",
    top_up: "Top Up",
    view_transactions: "View Transactions",
    low_balance: "Your balance is low. Top up to keep placing orders.",
    new_order: "New Order",
    order_history: "Order History",
    dashboard: "Dashboard",
    wallet: "Wallet",
    settings: "Settings",
    sign_out: "Sign out",
    confirm_order: "Confirm Order",
    status_received: "Received",
    status_washing: "Washing / Cleaning",
    status_ready: "Ready",
    status_delivered: "Delivered",
    status_pending: "Pending",
    status_cancelled: "Cancelled",
    no_active_order: "No active orders yet",
    place_first_order: "Place your first order",
    drop_off: "I'll drop off myself",
    request_pickup: "Request pickup & delivery",
    laundry: "Laundry",
    cleaning: "Cleaning",
    repeat_order: "Order again",
  },
  pidgin: {
    place_order: "Drop Your Order",
    wallet_balance: "Your Money Wey Dey",
    top_up: "Add Money",
    view_transactions: "See Wetin You Don Spend",
    low_balance: "Your money don almost finish o! Add some sharp sharp.",
    new_order: "Drop New Order",
    order_history: "Wetin You Don Order",
    dashboard: "Home",
    wallet: "Money",
    settings: "Settings",
    sign_out: "Comot",
    confirm_order: "Confirm Am",
    status_received: "We Don See Am",
    status_washing: "We Dey Wash Am",
    status_ready: "E Don Ready",
    status_delivered: "We Don Bring Am",
    status_pending: "Dey Wait",
    status_cancelled: "Dem Cancel Am",
    no_active_order: "You never order anything",
    place_first_order: "Drop your first order",
    drop_off: "I go bring am myself",
    request_pickup: "Make una come pick am",
    laundry: "Laundry",
    cleaning: "Cleaning",
    repeat_order: "Order am again",
  },
} as const;

export type StringKey = keyof typeof STRINGS.en;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key];
}
