// txn-analyze.jsx — transactional inventory schema: parser + analyzer
// Exposes: parseSKU, normalizeTransactions, analyzeTransactional, detectSchema, BUILDINGS, TYPES, BUILDING_LABEL, TYPE_LABEL

const BUILDINGS = ['T1', 'T2', 'SM'];
const TYPES = ['EL', 'BL', 'PL'];
const BUILDING_LABEL = { T1: 'T1', T2: 'T2', SM: 'SM', Other: 'Other' };
const TYPE_LABEL = { EL: 'Electrical', BL: 'Building', PL: 'Plumbing', Other: 'Other' };
const TYPE_COLOR = {
  EL: 'oklch(0.68 0.07 235)',   // dusty blue
  BL: 'oklch(0.68 0.06 145)',   // sage
  PL: 'oklch(0.72 0.05 70)',    // tan
  Other: 'oklch(0.70 0.02 0)'
};

function parseSKU(sku) {
  if (!sku) return { building: 'Other', kind: 'Other', code: '' };
  const s = String(sku).toUpperCase().trim();
  const m = s.match(/^(T1|T2|SM)(EL|BL|PL)/);
  if (m) return { building: m[1], kind: m[2], code: s };
  return { building: 'Other', kind: 'Other', code: s };
}

function detectSchema(rows) {
  if (!rows || rows.length === 0) return 'empty';
  const headers = Object.keys(rows[0]).map(h => String(h).toLowerCase());
  const has = (k) => headers.some(h => h.includes(k));
  if (has('change of quantity') || (has('transaction') && has('quantity'))) return 'transactional';
  return 'snapshot';
}

function normalizeTransactions(rows) {
  return rows
    .filter(r => r['Transaction Date']) // skip totals row at the bottom
    .map(r => {
      const sku = String(r['Stock Code (SKU)'] || '').trim();
      const parsed = parseSKU(sku);
      const date = new Date(r['Transaction Date']);
      const qty = Number(r['Change of Quantity']) || 0;
      const txnType = String(r['Transaction Type'] || '').trim();
      const cost = Number(r['Unit Cost (S$)']) || 0;
      return {
        sku,
        name: String(r['Inventory Catalog Item'] || '').trim() || sku,
        date, ts: +date,
        txnType,
        qty,
        unitCost: cost,
        building: parsed.building,
        kind: parsed.kind
      };
    })
    .filter(t => t.sku && !isNaN(t.ts));
}

// ---- Bucketing ---- //
function bucketKeyFor(rangeDays) {
  if (rangeDays <= 60) return (d) => d.toISOString().slice(0, 10);
  if (rangeDays <= 400) return (d) => {
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x.toISOString().slice(0, 10);
  };
  return (d) => d.toISOString().slice(0, 7);
}

function bucketingFor(rangeDays) {
  if (rangeDays <= 60) return 'day';
  if (rangeDays <= 400) return 'week';
  return 'month';
}

function fillBuckets(start, end, bucketing) {
  const out = [];
  const d = new Date(start);
  if (bucketing === 'day') {
    d.setHours(0, 0, 0, 0);
    while (+d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  } else if (bucketing === 'week') {
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    while (+d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
  } else {
    d.setDate(1); d.setHours(0, 0, 0, 0);
    while (+d <= end) {
      out.push(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() + 1);
    }
  }
  return out;
}

// ---- Health-metric helpers (dead stock + reorder point) ---- //
function dailyUsageStats(rows, maxTs, windowDays = 90) {
  const start = maxTs - windowDays * 86400000;
  const dailyIssued = new Map();
  for (const t of rows) {
    if (t.ts < start || t.ts > maxTs) continue;
    if (t.qty >= 0) continue;
    const day = new Date(t.ts); day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    dailyIssued.set(key, (dailyIssued.get(key) || 0) + (-t.qty));
  }
  const values = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    values.push(dailyIssued.get(key) || 0);
  }
  const mean = values.reduce((a, b) => a + b, 0) / windowDays;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / windowDays;
  return { avgDailyUsage: mean, stdDev: Math.sqrt(variance) };
}

function computeHealth(rows, maxTs, lastActivity, currentStock, opts) {
  const { leadTimeDays, deadThresholdDays, zValue } = opts;
  const { avgDailyUsage, stdDev } = dailyUsageStats(rows, maxTs);
  const daysSinceLastTxn = lastActivity ? Math.floor((maxTs - lastActivity) / 86400000) : Infinity;
  const isDead = daysSinceLastTxn > deadThresholdDays;
  const safetyStock = zValue * stdDev * Math.sqrt(leadTimeDays);
  const reorderPoint = avgDailyUsage * leadTimeDays + safetyStock;
  const needsPurchase = !isDead && currentStock < reorderPoint;
  return { avgDailyUsage, stdDev, reorderPoint, isDead, needsPurchase, daysSinceLastTxn };
}

// ---- Main analyzer ---- //
function analyzeTransactional(txns, filters = {}) {
  const {
    range = '90d', building = 'All', kind = 'All', search = '',
    leadTimeDays = 7, deadThresholdDays = 90, zValue = 1.65
  } = filters;
  const s = (search || '').trim().toLowerCase();

  if (!txns.length) {
    return { schema: 'transactional', empty: true };
  }

  const maxTs = Math.max(...txns.map(t => t.ts));
  const minTs = Math.min(...txns.map(t => t.ts));

  let rangeStart;
  if (range === 'All') rangeStart = minTs;
  else if (range === '7d') rangeStart = maxTs - 7 * 86400000;
  else if (range === '30d') rangeStart = maxTs - 30 * 86400000;
  else if (range === '90d') rangeStart = maxTs - 90 * 86400000;
  else if (range === '1y') rangeStart = maxTs - 365 * 86400000;
  else rangeStart = maxTs - 90 * 86400000;
  rangeStart = Math.max(rangeStart, minTs);

  const matchesBuilding = (t) => building === 'All' || t.building === building;
  const matchesKind = (t) => kind === 'All' || t.kind === kind;
  const matchesSearch = (t) => !s || (`${t.name} ${t.sku}`).toLowerCase().includes(s);

  // ALL filtered (for current stock, which is sum from start to end per user spec)
  const allFiltered = txns.filter(t => matchesBuilding(t) && matchesKind(t) && matchesSearch(t));

  // Period filtered (for everything time-bounded)
  const periodTxns = allFiltered.filter(t => t.ts >= rangeStart && t.ts <= maxTs);

  // ---- Per-SKU aggregates ---- //
  const skuMap = new Map();
  for (const t of allFiltered) {
    let s2 = skuMap.get(t.sku);
    if (!s2) {
      s2 = {
        sku: t.sku, name: t.name, building: t.building, kind: t.kind,
        currentStock: 0,           // all-time signed sum
        totalReceived: 0,          // all-time inflow
        totalIssued: 0,            // all-time outflow
        lastReceived: null,
        lastIssued: null,
        lastActivity: null,
        recvInPeriod: 0,
        issuedInPeriod: 0,
        txnCount: 0,
        rows: []
      };
      skuMap.set(t.sku, s2);
    }
    s2.rows.push({ ts: t.ts, qty: t.qty });
    s2.currentStock += t.qty;
    if (t.qty > 0) {
      s2.totalReceived += t.qty;
      if (!s2.lastReceived || t.ts > s2.lastReceived) s2.lastReceived = t.ts;
    } else if (t.qty < 0) {
      s2.totalIssued += -t.qty;
      if (!s2.lastIssued || t.ts > s2.lastIssued) s2.lastIssued = t.ts;
    }
    if (!s2.lastActivity || t.ts > s2.lastActivity) s2.lastActivity = t.ts;
    s2.txnCount += 1;
  }
  for (const t of periodTxns) {
    const s2 = skuMap.get(t.sku);
    if (!s2) continue;
    if (t.qty > 0) s2.recvInPeriod += t.qty;
    else if (t.qty < 0) s2.issuedInPeriod += -t.qty;
  }

  const skus = [...skuMap.values()];
  const healthOpts = { leadTimeDays, deadThresholdDays, zValue };
  for (const x of skus) {
    const health = computeHealth(x.rows, maxTs, x.lastActivity, x.currentStock, healthOpts);
    Object.assign(x, health);
  }
  const activeSKUs = skus.filter(x => x.currentStock > 0).length;
  const onHand = skus.reduce((a, x) => a + Math.max(0, x.currentStock), 0);
  const deadCount = skus.filter(x => x.isDead).length;
  const needsPurchaseCount = skus.filter(x => x.needsPurchase).length;

  // ---- Period totals ---- //
  let receiptsCount = 0, issuancesCount = 0;
  let receiptUnits = 0, issuanceUnits = 0;
  for (const t of periodTxns) {
    if (t.qty > 0) { receiptsCount++; receiptUnits += t.qty; }
    else if (t.qty < 0) { issuancesCount++; issuanceUnits += -t.qty; }
  }

  // ---- Time series (filled to include empty buckets) ---- //
  const rangeDays = (maxTs - rangeStart) / 86400000;
  const bucketKey = bucketKeyFor(rangeDays);
  const bucketing = bucketingFor(rangeDays);
  const filledKeys = fillBuckets(rangeStart, maxTs, bucketing);

  const tsMap = new Map(filledKeys.map(k => [k, { bucket: k, received: 0, issued: 0 }]));
  // Per-bucket per-SKU breakdown, so hover tooltips can show what actually moved.
  const bucketSkuMap = new Map();
  for (const t of periodTxns) {
    const k = bucketKey(t.date);
    let b = tsMap.get(k);
    if (!b) { b = { bucket: k, received: 0, issued: 0 }; tsMap.set(k, b); }
    if (t.qty > 0) b.received += t.qty;
    else if (t.qty < 0) b.issued += -t.qty;

    let bm = bucketSkuMap.get(k);
    if (!bm) { bm = new Map(); bucketSkuMap.set(k, bm); }
    let entry = bm.get(t.sku);
    if (!entry) { entry = { sku: t.sku, name: t.name, received: 0, issued: 0 }; bm.set(t.sku, entry); }
    if (t.qty > 0) entry.received += t.qty;
    else if (t.qty < 0) entry.issued += -t.qty;
  }
  const topN = (bm, key, n = 5) => {
    if (!bm) return [];
    return [...bm.values()]
      .filter(e => e[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, n);
  };
  const timeSeries = [...tsMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map(b => {
      const bm = bucketSkuMap.get(b.bucket);
      return { ...b, topReceived: topN(bm, 'received'), topIssued: topN(bm, 'issued') };
    });

  // ---- Cumulative qty-on-hand across the same timeline ---- //
  // Balance carried into the window: net of every matching transaction before rangeStart.
  const startBalance = allFiltered
    .filter(t => t.ts < rangeStart)
    .reduce((a, t) => a + t.qty, 0);
  let runningOnHand = startBalance;
  const onHandSeries = timeSeries.map(b => {
    runningOnHand += (b.received - b.issued);
    return { bucket: b.bucket, onHand: runningOnHand };
  });

  // ---- By building ---- //
  const byBuilding = BUILDINGS.map(b => {
    let r = 0, i = 0, c = 0;
    for (const t of periodTxns) {
      if (t.building !== b) continue;
      c++;
      if (t.qty > 0) r += t.qty;
      else if (t.qty < 0) i += -t.qty;
    }
    return { name: b, label: BUILDING_LABEL[b], received: r, issued: i, count: c };
  });

  // ---- By kind (EL/BL/PL) ---- //
  const byKind = TYPES.map(k => {
    let r = 0, i = 0, c = 0;
    for (const t of periodTxns) {
      if (t.kind !== k) continue;
      c++;
      if (t.qty > 0) r += t.qty;
      else if (t.qty < 0) i += -t.qty;
    }
    return { name: k, label: TYPE_LABEL[k], received: r, issued: i, count: c, color: TYPE_COLOR[k] };
  });

  // ---- 3×3 building × kind matrix ---- //
  const matrix = BUILDINGS.map(b => TYPES.map(k => {
    let r = 0, i = 0;
    const cellSkuMap = new Map();
    for (const t of periodTxns) {
      if (t.building === b && t.kind === k) {
        if (t.qty > 0) r += t.qty;
        else if (t.qty < 0) i += -t.qty;
        let entry = cellSkuMap.get(t.sku);
        if (!entry) { entry = { sku: t.sku, name: t.name, received: 0, issued: 0 }; cellSkuMap.set(t.sku, entry); }
        if (t.qty > 0) entry.received += t.qty;
        else if (t.qty < 0) entry.issued += -t.qty;
      }
    }
    const topIssued = [...cellSkuMap.values()].filter(e => e.issued > 0).sort((a, x) => x.issued - a.issued).slice(0, 5);
    const topReceived = [...cellSkuMap.values()].filter(e => e.received > 0).sort((a, x) => x.received - a.received).slice(0, 5);
    return { building: b, kind: k, received: r, issued: i, total: r + i, topIssued, topReceived };
  }));

  // ---- Fast movers (top by issuance in period) ---- //
  const fastMovers = [...skus]
    .filter(x => x.issuedInPeriod > 0)
    .sort((a, b) => b.issuedInPeriod - a.issuedInPeriod)
    .slice(0, 10);

  // Sparkline: issuances per bucket for each fast mover
  for (const fm of fastMovers) {
    const sm = new Map();
    for (const t of periodTxns) {
      if (t.sku !== fm.sku || t.qty >= 0) continue;
      const k = bucketKey(t.date);
      sm.set(k, (sm.get(k) || 0) + -t.qty);
    }
    fm.spark = timeSeries.map(b => sm.get(b.bucket) || 0);
  }

  // ---- Dead stock: days since last transaction exceeds the adjustable threshold ---- //
  const deadStock = skus
    .filter(x => x.isDead)
    .sort((a, b) => b.daysSinceLastTxn - a.daysSinceLastTxn)
    .slice(0, 12);

  // ---- Needs purchase (reorder point): non-dead items whose current stock has
  // dropped below the computed reorder point ---- //
  const needsPurchase = skus
    .filter(x => x.needsPurchase)
    .sort((a, b) => (a.currentStock - a.reorderPoint) - (b.currentStock - b.reorderPoint))
    .slice(0, 12);

  // ---- Recent activity ---- //
  const recentActivity = [...periodTxns]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 15);

  return {
    schema: 'transactional',
    empty: false,
    dataRange: { min: minTs, max: maxTs, rangeStart },
    bucketing,
    filters: { range, building, kind, search },
    totals: {
      skuCount: skus.length,
      activeSKUs,
      onHand,
      receiptsCount, issuancesCount,
      receiptUnits, issuanceUnits,
      netInPeriod: receiptUnits - issuanceUnits,
      deadCount, needsPurchaseCount
    },
    healthOpts,
    timeSeries, onHandSeries, byBuilding, byKind, matrix,
    fastMovers, deadStock, needsPurchase, recentActivity,
    skus
  };
}

// Detail for a single SKU: full running balance series + txn log + health metrics
function analyzeSKU(txns, sku, healthOpts = {}) {
  const rows = txns.filter(t => t.sku === sku).sort((a, b) => a.ts - b.ts);
  if (rows.length === 0) return null;
  let bal = 0;
  const series = rows.map(t => {
    bal += t.qty;
    return { date: t.date, ts: t.ts, balance: bal, qty: t.qty, txnType: t.txnType };
  });
  const first = rows[0];
  let totalReceived = 0, totalIssued = 0, lastReceived = null, lastIssued = null, lastActivity = null;
  for (const t of rows) {
    if (t.qty > 0) { totalReceived += t.qty; lastReceived = t.ts; }
    else if (t.qty < 0) { totalIssued += -t.qty; lastIssued = t.ts; }
    if (!lastActivity || t.ts > lastActivity) lastActivity = t.ts;
  }
  const maxTs = Math.max(...txns.map(t => t.ts));
  const { leadTimeDays = 7, deadThresholdDays = 90, zValue = 1.65 } = healthOpts;
  const health = computeHealth(rows.map(t => ({ ts: t.ts, qty: t.qty })), maxTs, lastActivity, bal, { leadTimeDays, deadThresholdDays, zValue });
  return {
    sku,
    name: first.name,
    building: first.building,
    kind: first.kind,
    currentStock: bal,
    totalReceived,
    totalIssued,
    lastReceived,
    lastIssued,
    series,
    txns: rows.slice().reverse(),
    ...health
  };
}

Object.assign(window, {
  parseSKU, normalizeTransactions, analyzeTransactional, analyzeSKU,
  detectSchema, BUILDINGS, TYPES, BUILDING_LABEL, TYPE_LABEL, TYPE_COLOR
});
