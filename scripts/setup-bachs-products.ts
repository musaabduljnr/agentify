/**
 * Setup script to create recurring Starter ($2.00/mo) and Growth ($10.00/mo) products in Bachs.
 * 
 * Usage:
 *   npx tsx scripts/setup-bachs-products.ts [sk_sandbox_... or sk_live_...]
 *
 * It checks if products already exist in Bachs to avoid creating duplicates,
 * or creates them idempotently, printing the product IDs to configure in your environment.
 */

import { Bachs } from "@bachs/sdk";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const apiKeyArg = process.argv[2];
  const apiKey = apiKeyArg || process.env.BACHS_API_KEY;

  if (!apiKey || apiKey.includes("placeholder")) {
    console.error("❌ Error: No valid BACHS_API_KEY provided.");
    console.error("Usage:");
    console.error("  npx tsx scripts/setup-bachs-products.ts <YOUR_BACHS_API_KEY>");
    console.error("  or set BACHS_API_KEY in your environment.");
    process.exit(1);
  }

  const isLive = apiKey.startsWith("sk_live_");
  const envName = isLive ? "production" : "sandbox";
  console.log(`🚀 Connecting to Bachs (${envName})...`);

  const bachs = new Bachs({
    apiKey,
    baseURL: process.env.BACHS_API_URL || undefined,
  });

  // 1. Check existing products to prevent duplicates
  console.log("🔍 Checking existing products in Bachs account...");
  let existingStarterId: string | null = null;
  let existingGrowthId: string | null = null;

  try {
    for await (const prod of bachs.products.listAll()) {
      const planMeta = prod.metadata?.plan;
      if (planMeta === "starter" || prod.name === "Agentify Starter") {
        existingStarterId = prod.id;
      }
      if (planMeta === "growth" || prod.name === "Agentify Growth") {
        existingGrowthId = prod.id;
      }
    }
  } catch (err: any) {
    console.warn("⚠️ Could not list existing products, will attempt direct creation:", err.message);
  }

  // 2. Setup Starter Product ($2.00 / month)
  let starterId = existingStarterId;
  if (starterId) {
    console.log(`✅ Found existing Agentify Starter product: ${starterId}`);
  } else {
    console.log("📦 Creating Agentify Starter ($2.00/mo USD)...");
    const starterProduct = await bachs.products.create(
      {
        name: "Agentify Starter",
        price: {
          currency: "USD",
          amount: "2.00",
        },
        billing_cycle: {
          interval: "month",
          frequency: 1,
        },
        metadata: {
          plan: "starter",
          app: "agentify",
        },
      },
      { idempotencyKey: `prod-agentify-starter-${envName}` }
    );
    starterId = starterProduct.id;
    console.log(`✅ Created Agentify Starter: ${starterId}`);
  }

  // 3. Setup Growth Product ($10.00 / month)
  let growthId = existingGrowthId;
  if (growthId) {
    console.log(`✅ Found existing Agentify Growth product: ${growthId}`);
  } else {
    console.log("📦 Creating Agentify Growth ($10.00/mo USD)...");
    const growthProduct = await bachs.products.create(
      {
        name: "Agentify Growth",
        price: {
          currency: "USD",
          amount: "10.00",
        },
        billing_cycle: {
          interval: "month",
          frequency: 1,
        },
        metadata: {
          plan: "growth",
          app: "agentify",
        },
      },
      { idempotencyKey: `prod-agentify-growth-${envName}` }
    );
    growthId = growthProduct.id;
    console.log(`✅ Created Agentify Growth: ${growthId}`);
  }

  console.log("\n=======================================================");
  console.log("🎉 Bachs Recurring Products Ready!");
  console.log("=======================================================");
  console.log(`BACHS_STARTER_PRODUCT_ID=${starterId}`);
  console.log(`BACHS_GROWTH_PRODUCT_ID=${growthId}`);
  console.log("=======================================================\n");

  // Optional: Auto-update or write to .env.local if present
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    let content = fs.readFileSync(envLocalPath, "utf8");
    if (content.includes("BACHS_STARTER_PRODUCT_ID=")) {
      content = content.replace(/BACHS_STARTER_PRODUCT_ID=.*/, `BACHS_STARTER_PRODUCT_ID=${starterId}`);
    } else {
      content += `\nBACHS_STARTER_PRODUCT_ID=${starterId}`;
    }

    if (content.includes("BACHS_GROWTH_PRODUCT_ID=")) {
      content = content.replace(/BACHS_GROWTH_PRODUCT_ID=.*/, `BACHS_GROWTH_PRODUCT_ID=${growthId}`);
    } else {
      content += `\nBACHS_GROWTH_PRODUCT_ID=${growthId}`;
    }

    fs.writeFileSync(envLocalPath, content, "utf8");
    console.log(`💾 Automatically updated .env.local with new product IDs.`);
  } else {
    console.log(`💡 Copy the product IDs above into your .env.local file.`);
  }
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
