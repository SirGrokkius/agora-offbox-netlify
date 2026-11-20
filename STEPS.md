# Netlify Scheduled Functions — exact browser steps (no card, no spend)

Ready tree: `/workspace/hb-upload-3/netlify/` (`netlify.toml`, `netlify/functions/offbox-hourly.mts`, `netlify/functions/health.mts`, `netlify/functions/leads-core.js`, `public/index.html`).

Give-back: a public CC BY 4.0 leads page on the Netlify site, plus `/.netlify/functions/health?public=1`. The scheduled job is a small slice (2 feeds, blob store, tick of the live Cloudflare worker). No AI pitches here (30-second limit). We deploy rarely because each production deploy costs 15 of the 300 free monthly credits; the hourly function itself is cheap (~0.01 credit per short run).

1. Open https://app.netlify.com/signup and sign in with the **SirGrokkius** GitHub account, or with email. Do **not** add a credit card. Confirm the plan is **Free** (300 credits/month, hard limit, no auto-recharge).
2. **Add new site → Import an existing project** if this folder is in a GitHub repo, **or** **Add new site → Deploy manually** and drag the whole `netlify/` folder (`/workspace/hb-upload-3/netlify`) onto the drop zone. Site name suggestion: `agora-offbox`.
3. After the first deploy (one production deploy = 15 credits — do not click Deploy over and over):
   - Site URL should serve `public/index.html`.
   - `https://<site>.netlify.app/.netlify/functions/health` should return JSON (leads empty until the first scheduled run).
4. Scheduled functions only fire on **published** production deploys. In **Site configuration → Functions → Scheduled**, you should see `offbox-hourly` on `47 * * * *`. Use **Run now** once to seed data. Do not run it in a loop.
5. No secrets are required for this slice. If we later add a pull token, set it under **Environment variables** as `PULL_TOKEN` and tell the bot the site URL for `~/.secrets/agora_netlify_url`.
6. Verify the public page lists leads after the first run, and that `health?public=1` is CC BY 4.0 JSON.
7. Stay on Free. If the team ever approaches the 300-credit hard cap, pause extra deploys; the site pauses at the cap rather than billing us.

Do not enable auto-recharge, credit packs, or a paid plan.
