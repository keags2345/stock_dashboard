# Stockwise — Inventory Movement Dashboard

A calm, animated inventory dashboard tailored for transactional stock data
(receipts, issuances, adjustments). Users drop in an Excel (`.xlsx`/`.xls`) or
`.csv` file, and Stockwise parses it entirely in the browser — no server, no
upload — and renders interactive visualizations with full time-range filtering.

## What it expects

A transaction log with these columns (auto-detected — exact names not required):

| Column | Description |
|---|---|
| Transaction Date | When the movement happened |
| Transaction Type | `Stock Receipt` / `Stock Issuance` / `Stock Adjustment` |
| Inventory Catalog Item | Item name |
| Stock Code (SKU) | SKU like `T2EL0011` — Building (T1/T2/SM) + Trade (EL/BL/PL) + ID |
| Unit Cost (S$) | Unit cost (kept but not central) |
| Change of Quantity | Signed integer (+ for receipts, − for issuances) |

The dashboard skips a trailing totals row automatically.

## What it visualizes

**Top filters:**
- Time range (7d / 30d / 90d / 1y / All) — re-runs every chart
- Building (T1 / T2 / SM / All)
- Trade (Electrical / Building / Plumbing / All)
- Search by SKU or item

**KPI tiles (count-up animated):**
- Active SKUs (with current stock > 0)
- Units on hand (running balance from all transactions)
- Units received in period
- Units issued in period

**Movement section:**
- Receipts vs Issuances over time — diverging bar chart (receipts up / issuances down), auto-buckets to daily/weekly/monthly based on range
- Activity by Building × Trade — 3×3 heatmap of units issued

**Velocity section:**
- Fast movers — top 10 SKUs by issuances in period, with current stock and days since last issuance
- Dead stock — items with stock but no issuance in period

**Stock health section:**
- At-risk items — current stock ≤ 3 (computed from all-time net change)
- Recent transactions — last 15 in the selected period

**SKU drill-down:**
Click any SKU anywhere → drawer opens with the SKU's running balance line chart, last receipt/issuance dates, and full transaction history.

## Calm aesthetic
Soft sage & cream by default. Use the floating **Tweaks** panel to switch palette (Sage / Blue / Earth / Navy), density, or dark mode. Fully animated entrance — blur-in cards, count-up numbers, drawing lines, growing bars.

## Run locally

It's a static site — any local server works:

```bash
# Python
python3 -m http.server 8080
# then open http://localhost:8080

# Or with Node
npx serve
```

## Deploy to Vercel

Stockwise is a pure static site, so Vercel deployment is trivial.

### Option 1 — drag & drop
1. Sign up at https://vercel.com (free tier is fine)
2. Click **Add New → Project**
3. Drag this folder into the upload zone
4. Click **Deploy**. Done — you'll get a `*.vercel.app` URL.

### Option 2 — Git-based (recommended for updates)
1. Push this folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial Stockwise dashboard"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. On Vercel, click **Add New → Project → Import Git Repository**
3. Select your repo. Vercel auto-detects "Other" framework — leave defaults.
4. Click **Deploy**.

Every push to `main` re-deploys automatically.

### Option 3 — Vercel CLI
```bash
npm i -g vercel
vercel
# answer the prompts; default settings work
```

## File structure

```
index.html         ← entry
styles.css         ← theme tokens + layout
app.jsx            ← root, schema-aware routing, Tweaks
upload.jsx         ← drop-zone landing screen
data.jsx           ← schema detection + dispatch, snapshot helpers
txn-analyze.jsx    ← transactional parser + analytics
txn-dashboard.jsx  ← transactional dashboard
dashboard.jsx     ← fallback snapshot dashboard (also auto-detected)
charts.jsx         ← SVG chart components
tweaks-panel.jsx   ← in-page Tweaks control panel
```

Everything is loaded via CDN (`React`, `Babel`, `SheetJS`) — no build step.

