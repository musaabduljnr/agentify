const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({path: '.env.local'});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function getKey() {
  const keyStr = process.env.CONFIG_ENCRYPTION_KEY;
  if (!keyStr) throw new Error("No encryption key");
  const encoding = /^[0-9a-fA-F]+$/.test(keyStr) ? "hex" : "base64";
  const buf = Buffer.from(keyStr, encoding);
  if (buf.length !== 32) throw new Error("Invalid key length: " + buf.length);
  return buf;
}

function encryptSecret(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  return `${iv.toString("base64")}:${authTag}:${encrypted}`;
}

async function run() {
  console.log("Updating database configs...");

  await supabase.from("platform_configurations").upsert([
    { category: "email", key: "from_email", value: "info@agentifychat.online", is_secret: false, is_active: true },
    { category: "email", key: "from_name", value: "Agentify", is_secret: false, is_active: true },
    { category: "smtp", key: "host", value: "mail.privateemail.com", is_secret: false, is_active: true },
    { category: "smtp", key: "port", value: "465", is_secret: false, is_active: true },
    { category: "smtp", key: "secure", value: "true", is_secret: false, is_active: true },
    { category: "smtp", key: "username", value: "info@agentifychat.online", is_secret: false, is_active: true },
    { category: "smtp", key: "password", encrypted_value: encryptSecret("ZGLw-2buM-cPHF-dN8U-KX35-nykQ"), value: null, is_secret: true, is_active: true }
  ], { onConflict: "category,key" });

  console.log("Database updated successfully.");
}

run().catch(console.error);
