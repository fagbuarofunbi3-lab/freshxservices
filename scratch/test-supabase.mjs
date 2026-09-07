import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

console.log("Testing Supabase connection to:", url);
console.log("Using key prefix:", key ? key.substring(0, 20) + "..." : "NONE");

const client = createClient(url, key);

async function test() {
  try {
    console.log("1. Testing RPC crypt_password...");
    const rpcRes = await client.rpc("crypt_password", { plain: "test1234" });
    console.log("RPC crypt_password result:", JSON.stringify(rpcRes));
  } catch (err) {
    console.error("RPC error:", err);
  }

  try {
    console.log("2. Testing profiles select...");
    const profileRes = await client.from("profiles").select("id, whatsapp_number, role").limit(2);
    console.log("Profiles select result:", JSON.stringify(profileRes));
  } catch (err) {
    console.error("Profiles error:", err);
  }
}

test();
