// data.jsx — sample data, Excel parsing, analytics
// Exposes: SAMPLE_DATA, parseFile, analyze, formatCurrency, formatNumber

const SAMPLE_CATEGORIES = [
  'Apparel', 'Electronics', 'Home Goods', 'Beauty', 'Outdoor', 'Footwear', 'Accessories'
];
const SAMPLE_LOCATIONS = ['Warehouse A', 'Warehouse B', 'Store — Downtown', 'Store — Westfield', 'Distribution Hub'];
const SAMPLE_SUPPLIERS = ['Northwind Co.', 'Cedar & Pine', 'Atlas Trading', 'Mossland Ltd.', 'Linden Supply'];

const PRODUCT_NAMES = {
  Apparel: ['Linen Overshirt', 'Merino Crewneck', 'Field Jacket', 'Cotton Tee', 'Pleated Trousers', 'Wool Cardigan', 'Chambray Shirt'],
  Electronics: ['Wireless Earbuds', 'Desk Lamp Pro', 'Travel Adapter', 'USB-C Hub', 'Bluetooth Speaker', 'Smart Plug', 'Mini Tripod'],
  'Home Goods': ['Ceramic Vase', 'Throw Blanket', 'Stoneware Mug', 'Linen Napkins', 'Cedar Candle', 'Glass Carafe', 'Cork Coaster Set'],
  Beauty: ['Hand Cream', 'Facial Mist', 'Lip Balm Trio', 'Shampoo Bar', 'Rose Serum', 'Bath Salts'],
  Outdoor: ['Trail Backpack', 'Insulated Bottle', 'Folding Chair', 'Lantern', 'Hiking Socks'],
  Footwear: ['Canvas Sneaker', 'Leather Boot', 'House Slippers', 'Running Shoe', 'Sandals'],
  Accessories: ['Leather Belt', 'Canvas Tote', 'Wool Scarf', 'Sun Hat', 'Card Wallet', 'Aviator Frames']
};

function seeded(n) {
  let s = n;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateSample() {
  const rng = seeded(7);
  const rows = [];
  let id = 1001;
  for (const cat of SAMPLE_CATEGORIES) {
    const names = PRODUCT_NAMES[cat];
    for (const name of names) {
      const variants = 1 + Math.floor(rng() * 2);
      for (let v = 0; v < variants; v++) {
        const reorderLevel = 20 + Math.floor(rng() * 80);
        // Make ~12% out of stock, ~18% low, rest healthy
        const r = rng();
        let qty;
        if (r < 0.12) qty = 0;
        else if (r < 0.30) qty = Math.floor(rng() * reorderLevel);
        else qty = reorderLevel + Math.floor(rng() * 400) + 30;

        const unitCost = +(4 + rng() * 180).toFixed(2);
        const supplier = SAMPLE_SUPPLIERS[Math.floor(rng() * SAMPLE_SUPPLIERS.length)];
        const location = SAMPLE_LOCATIONS[Math.floor(rng() * SAMPLE_LOCATIONS.length)];
        const daysAgo = Math.floor(rng() * 90);
        const restocked = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

        rows.push({
          SKU: `SW-${id++}`,
          Name: variants > 1 ? `${name} (Var ${v + 1})` : name,
          Category: cat,
          Location: location,
          Quantity: qty,
          'Reorder Level': reorderLevel,
          'Unit Cost': unitCost,
          Supplier: supplier,
          'Last Restocked': restocked
        });
      }
    }
  }
  return rows;
}

const SAMPLE_DATA = generateSample();

// ---- Field detection ---- //
const FIELD_MAP = {
  sku: ['sku', 'item code', 'item id', 'product code', 'id', 'item', 'code'],
  name: ['name', 'product', 'product name', 'item name', 'description', 'title'],
  category: ['category', 'cat', 'type', 'group', 'department', 'class'],
  location: ['location', 'warehouse', 'store', 'site', 'branch'],
  quantity: ['quantity', 'qty', 'stock', 'on hand', 'in stock', 'units', 'count', 'available'],
  reorder: ['reorder level', 'reorder point', 'reorder', 'min stock', 'threshold', 'min'],
  cost: ['unit cost', 'cost', 'price', 'unit price', 'value'],
  supplier: ['supplier', 'vendor', 'manufacturer', 'brand'],
  date: ['last restocked', 'restocked', 'received', 'date', 'updated']
};

function detectField(headers, kind) {
  const candidates = FIELD_MAP[kind];
  for (const h of headers) {
    const lower = String(h).toLowerCase().trim();
    if (candidates.includes(lower)) return h;
  }
  for (const h of headers) {
    const lower = String(h).toLowerCase().trim();
    if (candidates.some(c => lower.includes(c))) return h;
  }
  return null;
}

function normalizeRows(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const map = {
    SKU: detectField(headers, 'sku'),
    Name: detectField(headers, 'name'),
    Category: detectField(headers, 'category'),
    Location: detectField(headers, 'location'),
    Quantity: detectField(headers, 'quantity'),
    'Reorder Level': detectField(headers, 'reorder'),
    'Unit Cost': detectField(headers, 'cost'),
    Supplier: detectField(headers, 'supplier'),
    'Last Restocked': detectField(headers, 'date')
  };
  return rows.map((r, i) => {
    const out = {};
    for (const [k, src] of Object.entries(map)) {
      let v = src ? r[src] : null;
      if (k === 'Quantity' || k === 'Reorder Level') {
        v = Number(v ?? 0) || 0;
      } else if (k === 'Unit Cost') {
        v = Number(String(v ?? '0').replace(/[^0-9.\-]/g, '')) || 0;
      } else if (v == null) {
        v = '';
      }
      out[k] = v;
    }
    if (!out.SKU) out.SKU = `ROW-${i + 1}`;
    if (!out.Name) out.Name = `Item ${i + 1}`;
    if (!out.Category) out.Category = 'Uncategorized';
    if (!out.Location) out.Location = 'Unspecified';
    if (!out.Supplier) out.Supplier = 'Unknown';
    return out;
  });
}

async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  // Prefer a sheet named like "transactions" if present
  const sheetName = wb.SheetNames.find(n => /transaction/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  const schema = detectSchema(rows);
  if (schema === 'transactional') {
    return { schema, rows: normalizeTransactions(rows), sheetName, sheetNames: wb.SheetNames };
  }
  return { schema, rows: normalizeRows(rows), sheetName, sheetNames: wb.SheetNames };
}

// ---- Analytics ---- //
function analyze(rows, filters = {}) {
  const { category = 'All', location = 'All', search = '' } = filters;
  const s = search.trim().toLowerCase();

  const filtered = rows.filter(r => {
    if (category !== 'All' && r.Category !== category) return false;
    if (location !== 'All' && r.Location !== location) return false;
    if (s && !(`${r.Name} ${r.SKU} ${r.Supplier}`.toLowerCase().includes(s))) return false;
    return true;
  });

  const totalSKUs = filtered.length;
  const totalUnits = filtered.reduce((a, r) => a + r.Quantity, 0);
  const totalValue = filtered.reduce((a, r) => a + r.Quantity * r['Unit Cost'], 0);
  const outOfStock = filtered.filter(r => r.Quantity === 0).length;
  const lowStock = filtered.filter(r => r.Quantity > 0 && r.Quantity < r['Reorder Level']).length;
  const healthy = filtered.length - outOfStock - lowStock;

  // By category
  const catMap = new Map();
  for (const r of filtered) {
    const v = r.Quantity * r['Unit Cost'];
    const cur = catMap.get(r.Category) || { name: r.Category, value: 0, units: 0, count: 0 };
    cur.value += v; cur.units += r.Quantity; cur.count += 1;
    catMap.set(r.Category, cur);
  }
  const byCategory = [...catMap.values()].sort((a, b) => b.value - a.value);

  // By location
  const locMap = new Map();
  for (const r of filtered) {
    const v = r.Quantity * r['Unit Cost'];
    const cur = locMap.get(r.Location) || { name: r.Location, value: 0, units: 0, count: 0 };
    cur.value += v; cur.units += r.Quantity; cur.count += 1;
    locMap.set(r.Location, cur);
  }
  const byLocation = [...locMap.values()].sort((a, b) => b.value - a.value);

  // Top value SKUs
  const topValue = [...filtered]
    .map(r => ({ ...r, _value: r.Quantity * r['Unit Cost'] }))
    .sort((a, b) => b._value - a._value)
    .slice(0, 8);

  // Reorder alerts
  const reorderAlerts = filtered
    .filter(r => r.Quantity < r['Reorder Level'])
    .sort((a, b) => (a.Quantity / Math.max(1, a['Reorder Level'])) - (b.Quantity / Math.max(1, b['Reorder Level'])))
    .slice(0, 12);

  // Restock activity (by week)
  const weekMap = new Map();
  for (const r of filtered) {
    if (!r['Last Restocked']) continue;
    const d = new Date(r['Last Restocked']);
    if (isNaN(+d)) continue;
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const weekStart = new Date(day); weekStart.setDate(day.getDate() - day.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }
  const restockTrend = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([date, count]) => ({ date, count }));

  // Distinct values for filters
  const categories = ['All', ...new Set(rows.map(r => r.Category))];
  const locations = ['All', ...new Set(rows.map(r => r.Location))];

  return {
    totalSKUs, totalUnits, totalValue,
    outOfStock, lowStock, healthy,
    byCategory, byLocation,
    topValue, reorderAlerts, restockTrend,
    categories, locations,
    filtered
  };
}

function formatCurrency(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

Object.assign(window, { SAMPLE_DATA, parseFile, analyze, formatCurrency, formatNumber });
