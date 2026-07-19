// txn-dashboard.jsx — transactional inventory dashboard
const { useMemo: useMemo_t, useState: useState_t } = React;

const RANGE_OPTIONS = [
{ value: '7d', label: '7d' },
{ value: '30d', label: '30d' },
{ value: '90d', label: '90d' },
{ value: '1y', label: '1y' },
{ value: 'All', label: 'All' }];


function formatDate(ts) {
  if (ts == null) return '—';
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function relDays(ts, ref) {
  if (ts == null) return null;
  return Math.floor((ref - ts) / 86400000);
}

// Small hover-info affordance: a dotted-underline label with a floating
// explanation card. Used anywhere a computed metric (like reorder point)
// needs its formula spelled out inline.
function InfoHint({ children, title, lines }) {
  const [open, setOpen] = useState_t(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <span style={{ borderBottom: '1px dotted var(--text-faint)' }}>{children}</span>
      {open &&
      <div style={{
        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
        marginBottom: 8,
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '10px 12px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
        whiteSpace: 'normal', width: 260, zIndex: 20, textAlign: 'left'
      }}>
          {title && <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{title}</div>}
          {lines.map((l, i) =>
          <div key={i} style={{ color: i === lines.length - 1 ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: i ? 3 : 0 }}>
            {l}
          </div>
          )}
        </div>
      }
    </span>);

}

// Builds the explanation lines for a SKU's reorder point, showing the
// actual numbers plugged into the formula.
function reorderPointLines(it, leadTimeDays, zValue) {
  const safety = zValue * it.stdDev * Math.sqrt(leadTimeDays);
  return [
    'Reorder point = (avg daily usage × lead time) + safety stock',
    'Safety stock = Z × σ(daily usage) × √lead time',
    `avg/day ${it.avgDailyUsage.toFixed(2)} × lead time ${leadTimeDays}d = ${(it.avgDailyUsage * leadTimeDays).toFixed(1)}`,
    `Z ${zValue.toFixed(2)} × σ ${it.stdDev.toFixed(2)} × √${leadTimeDays} = ${safety.toFixed(1)}`,
    `= ${it.reorderPoint.toFixed(1)} units — order when stock drops below this`
  ];
}

function TxnDashboard({ txns, fileName, onReset }) {
  const [filters, setFilters] = useState_t({ range: '90d', building: 'All', kind: 'All', search: '', leadTimeDays: 7, deadThresholdDays: 90, zValue: 1.65 });
  const [activeSKU, setActiveSKU] = useState_t(null);

  const a = useMemo_t(() => analyzeTransactional(txns, filters), [txns, filters]);

  const filterKey = `${filters.range}|${filters.building}|${filters.kind}|${filters.search}|${filters.leadTimeDays}|${filters.deadThresholdDays}|${filters.zValue}`;
  const refTs = a.dataRange?.max ?? Date.now();

  const exportCSV = () => {
    if (!a.fastMovers) return;
    const rows = a.fastMovers.map((s) => ({
      SKU: s.sku, Name: s.name, Building: s.building, Type: s.kind,
      CurrentStock: s.currentStock, IssuedInPeriod: s.issuedInPeriod,
      ReceivedInPeriod: s.recvInPeriod,
      LastReceived: formatDate(s.lastReceived), LastIssued: formatDate(s.lastIssued)
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');a2.href = url;
    a2.download = `stockwise_fast_movers_${Date.now()}.csv`;a2.click();
    URL.revokeObjectURL(url);
  };

  if (a.empty) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="brand"><div className="brand-mark">S</div>Stockwise</div>
          <div className="spacer" />
          <button className="btn" onClick={onReset}>New file</button>
        </div>
        <div className="shell">
          <div className="empty-hint">No usable transactions found in that file.</div>
        </div>
      </div>);

  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          Stockwise <small>· Inventory Movement</small>
        </div>
        <div className="chip">
          <span className="dot" />
          {fileName}
        </div>
        <div className="chip" title="Date range of the data in this file">
          {formatDate(a.dataRange.min)} → {formatDate(a.dataRange.max)}
        </div>
        <div className="spacer" />
        <div className="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Search SKU or item…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          
        </div>
        <button className="btn btn-ghost" onClick={exportCSV}>Export</button>
        <button className="btn" onClick={onReset}>New file</button>
      </div>

      <div className="shell">
        {/* Filter row */}
        <div className="filter-bar fade-up">
          <div className="filter-group">
            <span className="filter-label">Range</span>
            <div className="seg">
              {RANGE_OPTIONS.map((o) =>
              <button key={o.value}
              className={`seg-btn ${filters.range === o.value ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, range: o.value })}>
                  {o.label}
                </button>
              )}
            </div>
            <span className="filter-meta">
              {formatDate(a.dataRange.rangeStart)} → {formatDate(a.dataRange.max)}
            </span>
          </div>
          <div className="filter-group">
            <span className="filter-label">Building</span>
            <div className="seg">
              {['All', ...BUILDINGS].map((b) =>
              <button key={b}
              className={`seg-btn ${filters.building === b ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, building: b })}>
                  {b}
                </button>
              )}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label">Trade</span>
            <div className="seg">
              {['All', ...TYPES].map((k) =>
              <button key={k}
              className={`seg-btn ${filters.kind === k ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, kind: k })}>
                  {k === 'All' ? 'All' : TYPE_LABEL[k]}
                </button>
              )}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label">Lead time</span>
            <input type="range" className="health-slider" min="1" max="60" value={filters.leadTimeDays}
              onChange={(e) => setFilters({ ...filters, leadTimeDays: Number(e.target.value) })} />
            <span className="filter-meta">{filters.leadTimeDays}d</span>
          </div>
          <div className="filter-group">
            <span className="filter-label">Dead after</span>
            <input type="range" className="health-slider" min="7" max="365" step="1" value={filters.deadThresholdDays}
              onChange={(e) => setFilters({ ...filters, deadThresholdDays: Number(e.target.value) })} />
            <span className="filter-meta">{filters.deadThresholdDays}d idle</span>
          </div>
          <div className="filter-group">
            <span className="filter-label">Service level (Z)</span>
            <input type="range" className="health-slider" min="0.5" max="3" step="0.05" value={filters.zValue}
              onChange={(e) => setFilters({ ...filters, zValue: Number(e.target.value) })} />
            <span className="filter-meta">{filters.zValue.toFixed(2)}</span>
          </div>
        </div>

        {/* KPIs (count-up re-animates on filter change via key) */}
        <div className="grid kpis" key={`kpis-${filterKey}`}>
          <KpiTileTxn label="Active SKUs" sub="with stock > 0"
          value={a.totals.activeSKUs} delay={0} color="var(--sage)"
          spark={a.timeSeries.map((d) => d.received + d.issued)} />
          <KpiTileTxn label="Units on hand" sub="current balance"
          value={a.totals.onHand} delay={80} color="var(--blue)"
          spark={a.timeSeries.map((d) => d.received)} />
          <KpiTileTxn label="Units received" sub={`${a.totals.receiptsCount} txns in period`}
          value={a.totals.receiptUnits} delay={160}
          spark={a.timeSeries.map((d) => d.received)}
          color="oklch(0.55 0.10 145)" />
          <KpiTileTxn label="Units issued" sub={`${a.totals.issuancesCount} txns in period`}
          value={a.totals.issuanceUnits} delay={240}
          spark={a.timeSeries.map((d) => d.issued)}
          color="oklch(0.55 0.12 35)" />
        </div>

        <div className="section-title fade-up">
          <h2>Movement</h2>
          <span className="meta">{a.bucketing}ly buckets · {a.timeSeries.length} {a.bucketing}s</span>
        </div>

        <div className="grid row-2" key={`mv-${filterKey}`}>
          <div className="card rise" style={{ animationDelay: '120ms' }}>
            <div className="card-head">
              <h3>Receipts vs issuances over time</h3>
              <span className="spacer" />
              <span className="hint">{a.bucketing.toUpperCase()}</span>
            </div>
            <DivergingBarChart data={a.timeSeries} onHandSeries={a.onHandSeries} bucketing={a.bucketing} />
          </div>
          <div className="card rise" style={{ animationDelay: '200ms' }}>
            <div className="card-head">
              <h3>Activity by building &amp; trade</h3>
              <span className="spacer" />
              <span className="hint">UNITS ISSUED</span>
            </div>
            <HeatmapMatrix
              matrix={a.matrix}
              rows={BUILDINGS} cols={TYPES}
              rowLabel={BUILDING_LABEL} colLabel={TYPE_LABEL}
              valueKey="issued" />
            
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {a.byBuilding.map((b, i) =>
              <div key={b.name} style={{
                flex: 1, minWidth: 100,
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                animation: `fadeUp 500ms ease ${300 + i * 60}ms both`
              }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.name}</div>
                  <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{formatNumber(b.received + b.issued)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{b.count} txns</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="section-title fade-up">
          <h2>Velocity</h2>
          <span className="meta">Fastest movers and dead stock for the selected period</span>
        </div>

        <div className="grid row-2" key={`vel-${filterKey}`}>
          <div className="card rise" style={{ animationDelay: '120ms' }}>
            <div className="card-head">
              <h3>Fast movers</h3>
              <span className="spacer" />
              <span className="hint">TOP 10 ISSUED</span>
            </div>
            <FastMoversList items={a.fastMovers} refTs={refTs} onPick={setActiveSKU} />
          </div>
          <div className="card rise" style={{ animationDelay: '120ms' }}>
            <div className="card-head">
              <h3>Dead stock</h3>
              <span className="spacer" />
              <span className="hint">&gt;{filters.deadThresholdDays}D INACTIVE · {a.totals.deadCount}</span>
            </div>
            <DeadStockTable items={a.deadStock} onPick={setActiveSKU} />
          </div>
        </div>

        <div className="section-title fade-up">
          <h2>Stock health</h2>
          <span className="meta">Reorder point = avg daily usage × lead time + Z × σ(daily usage) × √lead time · excludes dead stock</span>
        </div>

        <div className="grid row-2" key={`sh-${filterKey}`}>
          <div className="card rise" style={{ animationDelay: '120ms' }}>
            <div className="card-head">
              <h3>Needs purchase</h3>
              <span className="spacer" />
              <span className="hint">BELOW REORDER PT · {a.totals.needsPurchaseCount}</span>
            </div>
            <NeedsPurchaseTable items={a.needsPurchase} onPick={setActiveSKU} leadTimeDays={filters.leadTimeDays} zValue={filters.zValue} />
          </div>
          <div className="card rise" style={{ animationDelay: '200ms' }}>
            <div className="card-head">
              <h3>Recent transactions</h3>
              <span className="spacer" />
              <span className="hint">LAST 15 IN PERIOD</span>
            </div>
            <RecentActivity items={a.recentActivity} onPick={setActiveSKU} />
          </div>
        </div>
      </div>

      {activeSKU &&
      <SKUDetail sku={activeSKU} txns={txns} onClose={() => setActiveSKU(null)} healthOpts={a.healthOpts} />
      }
    </div>);

}

function KpiTileTxn({ label, sub, value, spark, color, delay }) {
  return (
    <div className="card kpi rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="label">{label}</div>
      <div className="value">
        <CountUp value={value} delay={delay + 100} />
      </div>
      <div className="spark"><Sparkline points={spark.length ? spark : [0, 0, 0]} color={color} /></div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {sub}
      </div>
    </div>);

}

function FastMoversList({ items, refTs, onPick }) {
  if (!items || items.length === 0) return <div className="empty-hint">No issuances in the selected period.</div>;
  const max = Math.max(...items.map((i) => i.issuedInPeriod));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => {
        const pct = it.issuedInPeriod / max * 100;
        const daysSince = relDays(it.lastIssued, refTs);
        return (
          <div key={it.sku}
          style={{ animation: `fadeUp 500ms ease ${i * 50 + 100}ms both`, cursor: 'pointer' }}
          onClick={() => onPick(it.sku)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', minWidth: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{it.sku}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>−{it.issuedInPeriod}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <div className="bar-track" style={{ height: 5 }}>
                <div className="bar-fill grow-w" style={{
                  width: `${pct}%`,
                  animationDelay: `${i * 50 + 200}ms`,
                  background: 'linear-gradient(90deg, oklch(0.72 0.08 35), oklch(0.55 0.12 35))'
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                stock {it.currentStock} · {daysSince != null ? `${daysSince}d ago` : 'never'}
              </div>
            </div>
          </div>);

      })}
    </div>);

}

function DeadStockTable({ items, onPick }) {
  if (!items || items.length === 0) return <div className="empty-hint">No dead stock at the current threshold.</div>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Item</th>
          <th style={{ textAlign: 'right' }}>Stock</th>
          <th style={{ textAlign: 'right' }}>Idle for</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) =>
        <tr key={it.sku} style={{ animation: `fadeUp 400ms ease ${i * 30 + 100}ms both`, cursor: 'pointer' }} onClick={() => onPick(it.sku)}>
            <td className="mono">{it.sku}</td>
            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</td>
            <td className="num">{it.currentStock}</td>
            <td className="num" style={{ color: 'var(--text-muted)' }}>
              {isFinite(it.daysSinceLastTxn) ? `${it.daysSinceLastTxn}d` : <span style={{ color: 'var(--danger)' }}>never</span>}
            </td>
          </tr>
        )}
      </tbody>
    </table>);

}

function NeedsPurchaseTable({ items, onPick, leadTimeDays, zValue }) {
  if (!items || items.length === 0) return <div className="empty-hint">Nothing below its reorder point right now.</div>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Item</th>
          <th style={{ textAlign: 'right' }}>Stock</th>
          <th style={{ textAlign: 'right' }}>Reorder pt</th>
          <th style={{ textAlign: 'right' }}>Avg/day</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => {
          const status = it.currentStock <= 0 ? 'out' : 'low';
          return (
            <tr key={it.sku} style={{ animation: `fadeUp 400ms ease ${i * 30 + 100}ms both`, cursor: 'pointer' }}>
              <td className="mono" onClick={() => onPick(it.sku)}>{it.sku}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => onPick(it.sku)}>{it.name}</td>
              <td className="num" onClick={() => onPick(it.sku)}><span className={`status ${status}`} style={{ marginRight: 6 }}><span className="dot" /></span>{it.currentStock}</td>
              <td className="num" style={{ color: 'var(--text-muted)' }}>
                <InfoHint title="Reorder point" lines={reorderPointLines(it, leadTimeDays, zValue)}>{it.reorderPoint.toFixed(1)}</InfoHint>
              </td>
              <td className="num" style={{ color: 'var(--text-muted)' }} onClick={() => onPick(it.sku)}>{it.avgDailyUsage.toFixed(2)}</td>
            </tr>);

        })}
      </tbody>
    </table>);

}

function RecentActivity({ items, onPick }) {
  if (!items || items.length === 0) return <div className="empty-hint">No transactions in this period.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
      {items.map((t, i) => {
        const dirRecv = t.qty > 0;
        return (
          <div key={i}
          style={{
            display: 'grid', gridTemplateColumns: '70px 1fr 60px 70px',
            gap: 10, alignItems: 'center',
            padding: '8px 6px', borderRadius: 8,
            animation: `fadeUp 400ms ease ${i * 25 + 100}ms both`,
            cursor: 'pointer'
          }}
          onClick={() => onPick(t.sku)}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{formatDate(t.ts).slice(5)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>{t.sku}</div>
            </div>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>{t.txnType.replace('Stock ', '')}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
              color: dirRecv ? 'oklch(0.50 0.09 145)' : 'oklch(0.50 0.12 35)',
              textAlign: 'right'
            }}>
              {dirRecv ? '+' : ''}{t.qty}
            </span>
          </div>);

      })}
    </div>);

}

// ---- SKU Detail Drawer ---- //
function SKUDetail({ sku, txns, onClose, healthOpts }) {
  const detail = useMemo_t(() => analyzeSKU(txns, sku, healthOpts), [txns, sku, healthOpts]);
  if (!detail) return null;
  const refTs = Math.max(...txns.map((t) => t.ts));
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {detail.sku} · {BUILDING_LABEL[detail.building] || detail.building} · {TYPE_LABEL[detail.kind] || detail.kind}
            </div>
            <h2 style={{ margin: '6px 0 0', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, letterSpacing: '-0.02em' }}>
              {detail.name}
            </h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ alignSelf: 'flex-start' }}>Close ✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {detail.isDead &&
          <span className="status out"><span className="dot" />Dead stock · idle {isFinite(detail.daysSinceLastTxn) ? `${detail.daysSinceLastTxn}d` : ''}</span>
          }
          {!detail.isDead && detail.needsPurchase &&
          <span className="status low"><span className="dot" />Needs purchase</span>
          }
          {!detail.isDead && !detail.needsPurchase &&
          <span className="status ok"><span className="dot" />Healthy</span>
          }
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
          <StatBlock label="Current stock" value={detail.currentStock} highlight={detail.needsPurchase || detail.currentStock <= 0} />
          <StatBlock label="Total received" value={detail.totalReceived} />
          <StatBlock label="Total issued" value={detail.totalIssued} />
          <StatBlock label="Last activity" value={formatDate(detail.series[detail.series.length - 1].ts)} mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
          <StatBlock label="Avg daily usage" value={detail.avgDailyUsage.toFixed(2)} mono />
          <StatBlock label="Usage σ (90d)" value={detail.stdDev.toFixed(2)} mono />
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: detail.needsPurchase ? 'color-mix(in oklch, var(--danger) 10%, var(--surface-2))' : 'var(--surface-2)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <InfoHint title="Reorder point" lines={reorderPointLines(detail, healthOpts.leadTimeDays, healthOpts.zValue)}>Reorder point</InfoHint>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500,
              color: detail.needsPurchase ? 'var(--danger)' : 'var(--text)', marginTop: 4
            }}>{detail.reorderPoint.toFixed(1)}</div>
          </div>
          <StatBlock label="Days idle" value={isFinite(detail.daysSinceLastTxn) ? detail.daysSinceLastTxn : '—'} mono highlight={detail.isDead} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 22 }}>
          <StatBlock label="Last receipt" value={detail.lastReceived ? `${formatDate(detail.lastReceived)} · ${relDays(detail.lastReceived, refTs)}d ago` : '—'} mono />
          <StatBlock label="Last issuance" value={detail.lastIssued ? `${formatDate(detail.lastIssued)} · ${relDays(detail.lastIssued, refTs)}d ago` : '—'} mono />
        </div>
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h3>Running stock balance</h3>
            <span className="spacer" />
            <span className="hint">{detail.series.length} TXNS</span>
          </div>
          <RunningBalanceChart series={detail.series} height={220} sku={detail.sku} name={detail.name} />
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Transaction history</h3>
            <span className="spacer" />
            <span className="hint">{detail.txns.length} ROWS</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {detail.txns.map((t, i) =>
                <tr key={i}>
                    <td className="mono">{formatDate(t.ts)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.txnType}</td>
                    <td className="num" style={{ color: t.qty > 0 ? 'oklch(0.50 0.09 145)' : 'oklch(0.50 0.12 35)' }}>
                      {t.qty > 0 ? '+' : ''}{t.qty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>);

}

function StatBlock({ label, value, highlight, mono }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: highlight ? 'color-mix(in oklch, var(--danger) 10%, var(--surface-2))' : 'var(--surface-2)',
      border: '1px solid var(--border)'
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontSize: mono ? 14 : 22,
        fontWeight: 500,
        color: highlight ? 'var(--danger)' : 'var(--text)',
        marginTop: 4,
        letterSpacing: mono ? 0 : '-0.02em'
      }}>{value}</div>
    </div>);

}

window.TxnDashboard = TxnDashboard;