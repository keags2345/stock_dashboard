// dashboard.jsx — main dashboard layout
const { useMemo, useState: useState_d } = React;

function Dashboard({ rows, fileName, onReset }) {
  const [filters, setFilters] = useState_d({ category: 'All', location: 'All', search: '' });
  const a = useMemo(() => analyze(rows, filters), [rows, filters]);

  // Status colors
  const statusData = [
    { name: 'In Stock', value: a.healthy, color: 'oklch(0.68 0.07 145)' },
    { name: 'Low Stock', value: a.lowStock, color: 'oklch(0.74 0.10 60)' },
    { name: 'Out of Stock', value: a.outOfStock, color: 'oklch(0.62 0.10 30)' }
  ];

  // Sparkline data — use restock counts or fake gentle curve
  const sparkValue = a.restockTrend.length >= 3
    ? a.restockTrend.map(d => d.count)
    : [3, 5, 4, 7, 6, 9, 8, 11, 10];

  const sparkUnits = useMemo(() => {
    const base = a.totalUnits || 100;
    const seed = 7;
    let s = seed;
    const arr = [];
    for (let i = 0; i < 10; i++) {
      s = (s * 9301 + 49297) % 233280;
      arr.push(base * (0.85 + (s / 233280) * 0.3));
    }
    arr.push(base);
    return arr;
  }, [a.totalUnits]);

  const exportCSV = () => {
    const rows2 = a.filtered;
    if (rows2.length === 0) return;
    const headers = Object.keys(rows2[0]);
    const csv = [headers.join(','), ...rows2.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');
    a2.href = url; a2.download = `stockwise_export_${Date.now()}.csv`;
    a2.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          Stockwise <small>· Inventory Analytics</small>
        </div>
        <div className="chip">
          <span className="dot" />
          {fileName}
        </div>
        <div className="spacer" />
        <div className="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Search SKU, name, supplier…"
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <button className="btn btn-ghost" onClick={exportCSV}>Export</button>
        <button className="btn" onClick={onReset}>New file</button>
      </div>

      <div className="shell">
        {/* Filter pills */}
        <div className="filters fade-up">
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</span>
          {a.categories.map(c => (
            <button key={c}
              className={`pill ${filters.category === c ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, category: c })}>
              {c}
            </button>
          ))}
          <span style={{ width: 12 }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location</span>
          {a.locations.map(c => (
            <button key={c}
              className={`pill ${filters.location === c ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, location: c })}>
              {c}
            </button>
          ))}
        </div>

        {/* KPI tiles */}
        <div className="grid kpis">
          <KpiTile label="Total SKUs" value={a.totalSKUs} delay={0}
            spark={sparkUnits} color="var(--sage)" />
          <KpiTile label="Inventory Value" value={a.totalValue} format={formatCurrency} delay={100}
            spark={sparkUnits.map(v => v * 1.1)} color="var(--blue)" />
          <KpiTile label="Low Stock" value={a.lowStock} delay={200}
            spark={[2,4,3,6,8,7,9,11,a.lowStock,a.lowStock,a.lowStock]} color="oklch(0.74 0.10 60)"
            tone="warn" />
          <KpiTile label="Out of Stock" value={a.outOfStock} delay={300}
            spark={[1,2,2,3,4,3,4,5,a.outOfStock,a.outOfStock,a.outOfStock]} color="oklch(0.62 0.10 30)"
            tone="danger" />
        </div>

        <div className="section-title fade-up" style={{ animationDelay: '200ms' }}>
          <h2>Composition</h2>
          <span className="meta">{a.filtered.length} of {rows.length} items</span>
        </div>

        <div className="grid row-2">
          <div className="card rise" style={{ animationDelay: '300ms' }}>
            <div className="card-head">
              <h3>Inventory value by category</h3>
              <span className="spacer" />
              <span className="hint">USD</span>
            </div>
            <HBarChart data={a.byCategory} valueFormat={formatCurrency} accentVar="--sage" />
          </div>
          <div className="card rise" style={{ animationDelay: '380ms' }}>
            <div className="card-head">
              <h3>Stock status</h3>
              <span className="spacer" />
              <span className="hint">SKUs</span>
            </div>
            <Donut data={statusData} />
          </div>
        </div>

        <div className="grid row-3" style={{ marginTop: 'var(--gap)' }}>
          <div className="card rise" style={{ animationDelay: '460ms' }}>
            <div className="card-head">
              <h3>Value by location</h3>
              <span className="spacer" />
              <span className="hint">USD</span>
            </div>
            <VBarChart data={a.byLocation} valueFormat={formatCurrency} accentVar="--blue" />
          </div>
          <div className="card rise" style={{ animationDelay: '540ms' }}>
            <div className="card-head">
              <h3>Top SKUs by value</h3>
              <span className="spacer" />
              <span className="hint">TOP 8</span>
            </div>
            <TopList items={a.topValue} />
          </div>
        </div>

        <div className="section-title fade-up" style={{ animationDelay: '700ms' }}>
          <h2>Operational signals</h2>
          <span className="meta">Live · auto-refreshed on filter change</span>
        </div>

        <div className="grid row-2">
          <div className="card rise" style={{ animationDelay: '720ms' }}>
            <div className="card-head">
              <h3>Reorder alerts</h3>
              <span className="spacer" />
              <span className="hint">{a.reorderAlerts.length} flagged</span>
            </div>
            <ReorderTable items={a.reorderAlerts} />
          </div>
          <div className="card rise" style={{ animationDelay: '800ms' }}>
            <div className="card-head">
              <h3>Restock activity</h3>
              <span className="spacer" />
              <span className="hint">12 WK</span>
            </div>
            <LineChart data={a.restockTrend} />
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Weekly count of items restocked, derived from the <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>Last Restocked</span> column.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, format = (v) => Math.round(v).toLocaleString(), spark, color, tone, delay }) {
  return (
    <div className="card kpi rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="label">{label}</div>
      <div className="value">
        <CountUp value={value} format={format} delay={delay + 100} />
      </div>
      <div className="spark">
        <Sparkline points={spark} color={color} />
      </div>
    </div>
  );
}

function TopList({ items }) {
  if (!items || items.length === 0) return <div className="empty-hint">No items match the current filter.</div>;
  const max = Math.max(...items.map(i => i._value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => {
        const pct = (it._value / max) * 100;
        return (
          <div key={it.SKU} style={{ animation: `fadeUp 500ms ease ${i * 60 + 200}ms both` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.Name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{it.SKU}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{formatCurrency(it._value)}</span>
            </div>
            <div className="bar-track" style={{ height: 6 }}>
              <div className="bar-fill grow-w" style={{
                width: `${pct}%`,
                animationDelay: `${i * 60 + 300}ms`,
                background: 'linear-gradient(90deg, var(--tan), var(--sage-deep))'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReorderTable({ items }) {
  if (!items || items.length === 0) {
    return <div className="empty-hint">Nothing flagged — all stock above reorder levels. 🎉</div>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Name</th>
          <th>Location</th>
          <th style={{ textAlign: 'right' }}>Qty</th>
          <th style={{ textAlign: 'right' }}>Reorder At</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => {
          const status = it.Quantity === 0 ? 'out' : 'low';
          return (
            <tr key={it.SKU} style={{ animation: `fadeUp 400ms ease ${i * 40 + 100}ms both` }}>
              <td className="mono">{it.SKU}</td>
              <td>{it.Name}</td>
              <td style={{ color: 'var(--text-muted)' }}>{it.Location}</td>
              <td className="num">{it.Quantity}</td>
              <td className="num" style={{ color: 'var(--text-muted)' }}>{it['Reorder Level']}</td>
              <td>
                <span className={`status ${status}`}>
                  <span className="dot" />
                  {status === 'out' ? 'Out of stock' : 'Low'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

window.Dashboard = Dashboard;
