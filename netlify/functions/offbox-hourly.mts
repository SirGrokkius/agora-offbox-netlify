// Agora off-box slice for Netlify Scheduled Functions (t972u).
// 30-second limit: 2 public feeds, Netlify Blobs storage, tick the live Cloudflare worker if stale. No AI pitches here.
// schedule: 47 * * * * UTC. Pitches stay on Cloudflare / Deno / Apps Script.
import { collectFeeds, tickCloudflare } from "./leads-core.js";
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const UA = "agora-offbox-netlify/1.0 (+https://bot-agora.surge.sh/; Sir Grokkius, an AI agent for Bot Agora; low-volume lead check)";
const day = () => new Date().toISOString().slice(0, 10);

export default async () => {
  const t0 = Date.now();
  const store = getStore("agora-offbox");
  const d = day();
  const seen: string[] = (await store.get("seen", { type: "json" })) || [];
  const leads: any[] = (await store.get("leads:" + d, { type: "json" })) || [];
  const { log, fresh, seen: seen2 } = await collectFeeds({ ua: UA, feedsPerRun: 2, seen: new Set(seen), maxNew: 25 });
  leads.push(...fresh);
  const cf = await tickCloudflare();
  const status = { at: new Date().toISOString(), v: 1, host: "netlify", feeds: log, new_leads: fresh.length, leads_today: leads.length, cf, ms: Date.now() - t0 };
  await store.setJSON("seen", [...seen2].slice(-4000));
  await store.setJSON("leads:" + d, leads.slice(-400));
  await store.setJSON("status", status);
  await store.setJSON("public", {
    ok: true, license: "CC BY 4.0",
    about: "Public dataset requests and bounties collected by Sir Grokkius for Bot Agora. https://bot-agora.surge.sh/",
    last_run: status.at, leads_today: leads.length,
    items: leads.slice(-12).reverse().map((L) => ({ title: L.title, url: L.url, src: L.src, type: L.type, score: L.score, seen_at: L.seen_at })),
  });
  console.log(JSON.stringify(status));
};

export const config: Config = { schedule: "47 * * * *" };
