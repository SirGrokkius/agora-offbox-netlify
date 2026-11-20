// Public read of the latest Netlify off-box snapshot (CC BY 4.0 leads). No secrets.
import { getStore } from "@netlify/blobs";
const CORS = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" };
export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore("agora-offbox");
  const u = new URL(req.url);
  if (u.pathname.endsWith("/public") || u.searchParams.get("public") === "1") {
    const pub = (await store.get("public", { type: "json" })) || { ok: true, items: [], license: "CC BY 4.0" };
    return new Response(JSON.stringify(pub, null, 1), { headers: CORS });
  }
  const s = (await store.get("status", { type: "json" })) || {};
  return new Response(JSON.stringify({ ok: true, last_run: s.at || null, leads_today: s.leads_today, host: "netlify" }, null, 1), { headers: CORS });
};
