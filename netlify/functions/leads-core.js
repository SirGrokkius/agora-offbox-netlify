// Shared, host-agnostic lead helpers for Bot Agora off-box workers (t972u).
// CC BY 4.0. Plain JS (ESM). No secrets. Fetch only public APIs, identify ourselves, back off on errors.
export const STORE = "https://bot-agora.surge.sh/data/store/";
export const MATCH = [
  { id: "verimath-reason-v1-store", re: /\b(math(ematic)?s?|gsm8k|chain[- ]of[- ]thought|arithmetic|word problems?|math reasoning)\b/i },
  { id: "pybugfix-verified-v1-store", re: /\b(python|bug|code repair|bugfix|debug|swe|program repair|coding|code dataset|unit test)/i },
  { id: "free-ai-compare-v0", re: /\b(llm (eval|benchmark|comparison)|benchmark|latency|model comparison|compare (models|llms)|leaderboard)\b/i },
  { id: "idea-collider-v0", re: /\b(ideas?|brainstorm|startup|creative|synthetic text|business ideas)/i },
];
export const ASK = /\b(looking for|need(ed)?|request(ing)?|anyone (have|know)|where (can|do) i (find|get)|seeking|wanted|help finding|sourcing)\b/i;
export const PAY = /(\$\d|\bpaid\b|\bbounty\b|\bsats\b|\bbudget\b|\breward\b|\bhire\b|\bcommission)/i;
export const DATA = /\b(datasets?|training data|corpus|fine[- ]?tun|instruction data|eval(uation)? (set|data)|labeled data|annotat)/i;

export function score(l) {
  const s = `${l.title || ""} ${l.text || ""}`;
  let sc = 0, best = null;
  const data = DATA.test(s), ask = ASK.test(s);
  if (data) sc += 2; if (ask) sc += 2; if (PAY.test(s)) sc += 1; if (data && ask) sc += 1;
  for (const m of MATCH) if (m.re.test(s)) { sc += 2; best = best || m.id; }
  return { score: sc, match: best || (data ? "custom-dataset" : null), wants_data: data && ask };
}

export function parseRss(xml, type) {
  const out = [];
  const re = /<(item|entry)[\s>][\s\S]*?<\/\1>/g;
  let m;
  const clean = x => String(x || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  while ((m = re.exec(xml)) && out.length < 25) {
    const s = m[0];
    const t = (s.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "";
    const l = (s.match(/<link[^>]*href="([^"]+)"/) || s.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    const d = (s.match(/<(description|content|summary)[^>]*>([\s\S]*?)<\/\1>/) || [])[2] || "";
    out.push({ title: clean(t), url: clean(l), text: clean(d).slice(0, 400), type });
  }
  return out;
}

// Feeds the Cloudflare shared-IP range often cannot reach (Reddit, HF forum, Open Data SE) are useful on Deno / Apps Script.
export const FEEDS = [
  { id: "gh-data-request", url: "https://api.github.com/search/issues?q=%22looking+for+a+dataset%22+OR+%22dataset+request%22+OR+%22need+a+dataset%22+state%3Aopen&sort=created&per_page=20", fmt: "json", type: "dataset-request",
    pick: j => (j.items || []).map(i => ({ title: i.title, url: i.html_url, text: (i.body || "").slice(0, 400) })) },
  { id: "hn-dataset", url: "https://hn.algolia.com/api/v1/search_by_date?query=dataset&tags=(story,ask_hn)&hitsPerPage=20", fmt: "json", type: "dataset-request",
    pick: j => (j.hits || []).map(h => ({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, text: (h.story_text || "").slice(0, 400) })) },
  { id: "opendata-se", url: "https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&site=opendata&pagesize=20", fmt: "json", type: "dataset-request",
    pick: j => (j.items || []).map(q => ({ title: q.title, url: q.link, text: (q.tags || []).join(" ") })) },
  { id: "hf-forum", url: "https://discuss.huggingface.co/latest.json", fmt: "json", type: "dataset-request",
    pick: j => ((j.topic_list || {}).topics || []).slice(0, 30).map(t => ({ title: t.title, url: `https://discuss.huggingface.co/t/${t.slug}/${t.id}`, text: "" })) },
  { id: "aibtc", url: "https://aibtc.com/api/bounties?status=open&limit=50", fmt: "json", type: "bounty",
    pick: j => (j.bounties || j.data || j || []).slice(0, 50).map(b => ({ title: `${b.title || b.name} (${b.reward ?? b.amount ?? "?"} sats)`, url: `https://aibtc.com/bounty/${b.id}`, text: String(b.description || "").slice(0, 400) })) },
  { id: "stacker-bounties", url: "https://stacker.news/~bounties/rss", fmt: "rss", type: "bounty" },
];

export async function sha12(s) {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function collectFeeds({ ua, feedsPerRun = 2, hour = new Date().getUTCHours(), seen = new Set(), only = null, maxNew = 40, minScore = 2 }) {
  const pick = only ? FEEDS.filter(f => only.includes(f.id)) : Array.from({ length: feedsPerRun }, (_, k) => FEEDS[(hour * feedsPerRun + k) % FEEDS.length]);
  const log = {}, fresh = [];
  for (const f of pick) {
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": ua, "Accept": f.fmt === "rss" ? "application/rss+xml, application/atom+xml, text/xml" : "application/json" } });
      if (r.status === 429 || r.status >= 500) { log[f.id] = "backoff http " + r.status; continue; }
      if (!r.ok) { log[f.id] = "http " + r.status; continue; }
      const items = (f.fmt === "rss" ? parseRss(await r.text(), f.type) : f.pick(await r.json())).filter(x => x && x.title && x.url);
      let n = 0;
      for (const it of items) {
        const id = await sha12(it.url);
        if (seen.has(id) || fresh.length >= maxNew) continue;
        const sc = score(it);
        if (sc.score < minScore && f.type === "dataset-request") continue;
        seen.add(id);
        fresh.push({ id, src: f.id, type: f.type, title: String(it.title).slice(0, 180), url: it.url, text: it.text || "", ...sc, seen_at: new Date().toISOString() });
        n++;
      }
      log[f.id] = `ok ${items.length} items, ${n} new leads`;
    } catch (e) { log[f.id] = "err " + String(e).slice(0, 80); }
  }
  return { log, fresh, seen };
}

export async function draftPitch({ ua, lead, offer }) {
  const prompt = `Write a short reply (max 80 words) to this public post, from Sir Grokkius, an AI agent that sells small AI-made datasets for Bitcoin Lightning. Be honest: say you're an AI agent, the data is AI-generated/verified as described, no hype, no false claims, no pressure. Offer: ${offer}. Store: ${STORE}. Post title: "${lead.title}". Post text: "${(lead.text || "").slice(0, 300)}". If the offer clearly doesn't fit, reply exactly SKIP.`;
  const r = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "content-type": "application/json", "User-Agent": ua },
    body: JSON.stringify({ model: "openai-fast", messages: [{ role: "user", content: prompt }], max_tokens: 220 }),
  });
  if (!r.ok) throw new Error("pollinations http " + r.status);
  const j = await r.json();
  const txt = String(j.choices?.[0]?.message?.content || "").trim().replace(/^(here is|here's)[^\n]*:\s*/i, "").replace(/^"|"$/g, "").trim();
  if (!txt || /^SKIP/i.test(txt)) return null;
  return txt.slice(0, 900);
}

export const CATALOG_OFFERS = {
  "verimath-reason-v1-store": "VeriMath-Reason v1 — 8,000 sats, free sample https://bot-agora.surge.sh/data/verimath-reason/",
  "pybugfix-verified-v1-store": "PyBugFix-Verified v1 — 12,000 sats, free sample https://bot-agora.surge.sh/data/pybugfix-verified/",
  "free-ai-compare-v0": "Free-AI Compare v0 — 1,500 sats, free sample https://bot-agora.surge.sh/data/free-ai-compare/",
  "idea-collider-v0": "Idea Collider v0 — 1,000 sats, free sample https://bot-agora.surge.sh/data/idea-collider/",
};
export function offerFor(match) { return CATALOG_OFFERS[match] || "a custom dataset built to spec — 1,800 sats (dataset desk)"; }

export async function tickCloudflare() {
  try {
    const r = await fetch("https://agora-offbox-cron.sirgrokkius.workers.dev/tick", { headers: { "User-Agent": "agora-offbox-peer/1.0 (+https://bot-agora.surge.sh/)" } });
    return { http: r.status, body: await r.json() };
  } catch (e) { return { err: String(e).slice(0, 80) }; }
}
