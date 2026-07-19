// charts.jsx — hand-rolled SVG chart components with entrance animations
// Exposes: CountUp, Sparkline, HBarChart, VBarChart, Donut, LineChart

const { useEffect, useRef, useState } = React;

// Animated number that counts up
function CountUp({ value, duration = 1100, format = (v) => v.toLocaleString(), delay = 0 }) {
  const [n, setN] = useState(0);
  const target = value;

  useEffect(() => {
    let raf;
    let fallback;
    const startedAt = performance.now() + delay;
    const tick = (t) => {
      if (t < startedAt) {raf = requestAnimationFrame(tick);return;}
      const elapsed = t - startedAt;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Fallback: if the tab is throttled (rAF paused), still land on the target
    fallback = setTimeout(() => setN(target), delay + duration + 60);
    return () => {cancelAnimationFrame(raf);clearTimeout(fallback);};
  }, [target, duration, delay]);

  return <span>{format(n)}</span>;
}

// Mini sparkline for KPI tiles
function Sparkline({ points, color = 'var(--sage)', width = 140, height = 36 }) {
  if (!points || points.length === 0) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const ys = points.map((p) => height - (p - min) / range * (height - 6) - 3);
  const d = points.map((_, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${ys[i]}`).join(' ');
  const len = 600;
  const areaD = d + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sparkGrad-${color.replace(/[^a-z0-9]/gi, '')})`} style={{ animation: 'fadeUp 800ms ease 200ms both' }} />
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"
      className="draw-line" style={{ '--len': len }} />
    </svg>);

}

// Horizontal bar chart
function HBarChart({ data, valueFormat = formatNumber, accentVar = '--sage' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {data.map((d, i) => {
        const pct = d.value / max * 100;
        return (
          <div key={d.name} className="bar-row" style={{ animation: `fadeUp 500ms ease ${i * 60}ms both` }}>
            <div className="name" title={d.name}>{d.name}</div>
            <div className="bar-track">
              <div
                className="bar-fill grow-w"
                style={{
                  width: `${pct}%`,
                  animationDelay: `${100 + i * 80}ms`,
                  background: `linear-gradient(90deg, var(${accentVar}), color-mix(in oklch, var(${accentVar}) 60%, black))`
                }} />
              
            </div>
            <div className="num">{valueFormat(d.value)}</div>
          </div>);

      })}
    </div>);

}

// Vertical bar chart (for locations / time)
function VBarChart({ data, height = 220, valueFormat = formatCurrency, accentVar = '--blue' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const containerRef = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 8, r: 8, t: 10, b: 32 };
  const innerW = Math.max(100, w - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const gap = 12;
  const barW = Math.max(20, (innerW - gap * (data.length - 1)) / data.length);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((t) =>
        <line
          key={t}
          x1={pad.l} x2={w - pad.r}
          y1={pad.t + innerH - innerH * t}
          y2={pad.t + innerH - innerH * t}
          stroke="var(--border)" strokeDasharray="2 4" />

        )}
        {data.map((d, i) => {
          const h = Math.max(2, d.value / max * innerH);
          const x = pad.l + i * (barW + gap);
          const y = pad.t + innerH - h;
          const isHover = hover === i;
          return (
            <g key={d.name} onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }}>
              <rect x={x - 2} y={pad.t} width={barW + 4} height={innerH} fill="transparent" pointerEvents="all" />
              <rect
                x={x} y={y}
                width={barW} height={h}
                rx="6"
                fill={`var(${accentVar})`}
                opacity={isHover ? 1 : 0.85}
                className="grow-h"
                style={{
                  transformOrigin: `${x + barW / 2}px ${pad.t + innerH}px`,
                  animationDelay: `${200 + i * 80}ms`
                }} />
              
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--text-muted)"
                style={{ animation: `fadeUp 500ms ease ${600 + i * 80}ms both` }}>
                
                {valueFormat(d.value)}
              </text>
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--text-muted)"
                style={{ animation: `fadeUp 500ms ease ${300 + i * 80}ms both` }}>
                
                {d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name}
              </text>
            </g>);

        })}
      </svg>
      {hover != null &&
      <div style={{
        position: 'absolute',
        left: Math.min(w - 160, pad.l + hover * (barW + gap)),
        top: 6,
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '8px 10px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
        whiteSpace: 'nowrap', zIndex: 2
      }}>
          <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{data[hover].name}</div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{valueFormat(data[hover].value)}</div>
        </div>
      }
    </div>);

}

// Donut chart for stock status
function Donut({ data, size = 180 }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - 14;
  const cx = size / 2,cy = size / 2;
  const circ = 2 * Math.PI * r;
  const [hover, setHover] = useState(null);

  let offset = 0;
  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} onMouseLeave={() => setHover(null)}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-2)" strokeWidth="16" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = circ * frac;
          const gap = circ - dash;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={d.name}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="16"
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={hover == null || hover === i ? 1 : 0.4}
              onMouseEnter={() => setHover(i)}
              style={{
                animation: `donutGrow 900ms cubic-bezier(0.16, 1, 0.3, 1) ${300 + i * 120}ms both`,
                transformOrigin: `${cx}px ${cy}px`,
                cursor: 'pointer'
              }} />);


        })}
        <text x={cx} y={cy - 4} textAnchor="middle"
        fontFamily="var(--font-display)" fontSize="22" fill="var(--text)" fontWeight="500"
        style={{ animation: 'fadeUp 600ms ease 800ms both' }}>
          {hover != null ? data[hover].value : total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
        fontSize="10" fill="var(--text-muted)"
        fontFamily="var(--font-mono)" letterSpacing="0.06em"
        style={{ animation: 'fadeUp 600ms ease 900ms both' }}>
          {hover != null ? data[hover].name.toUpperCase() : 'TOTAL SKUS'}
        </text>
      </svg>
      {hover != null &&
      <div style={{
        position: 'absolute', left: '50%', top: -8, transform: 'translate(-50%, -100%)',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '8px 10px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2
      }}>
          <div style={{ color: 'var(--text)', fontWeight: 500 }}>{data[hover].name}</div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {data[hover].value} · {(data[hover].value / total * 100).toFixed(1)}%
          </div>
        </div>
      }
      </div>
      <div className="donut-legend">
        {data.map((d, i) => {
          const pct = (d.value / total * 100).toFixed(1);
          return (
            <div className="legend-row" key={d.name}
              style={{ animation: `fadeUp 500ms ease ${i * 100 + 400}ms both`, cursor: 'pointer', opacity: hover == null || hover === i ? 1 : 0.5 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}>
              <span className="swatch" style={{ background: d.color }} />
              <span className="name">{d.name}</span>
              <span className="pct">{d.value} · {pct}%</span>
            </div>);

        })}
      </div>
      <style>{`@keyframes donutGrow { from { stroke-dasharray: 0 ${circ}; } }`}</style>
    </div>);

}

// Line chart for restock activity
function LineChart({ data, height = 160 }) {
  const containerRef = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  if (!data || data.length < 2) {
    return <div ref={containerRef} className="empty-hint">Not enough date data to plot a trend.</div>;
  }
  const pad = { l: 30, r: 12, t: 14, b: 24 };
  const innerW = Math.max(100, w - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.count));
  const stepX = innerW / (data.length - 1);
  const points = data.map((d, i) => [pad.l + i * stepX, pad.t + innerH - d.count / max * innerH]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaPath = path + ` L ${points[points.length - 1][0]} ${pad.t + innerH} L ${points[0][0]} ${pad.t + innerH} Z`;

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((t) =>
        <line key={t} x1={pad.l} x2={w - pad.r}
        y1={pad.t + innerH - innerH * t} y2={pad.t + innerH - innerH * t}
        stroke="var(--border)" strokeDasharray="2 4" />
        )}
        <path d={areaPath} fill="url(#lineGrad)" style={{ animation: 'fadeUp 800ms ease 600ms both' }} />
        <path d={path} stroke="var(--sage-deep)" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        className="draw-line" style={{ '--len': 2000 }} />
        {points.map((p, i) =>
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={hover === i ? 15 : 10} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
          <circle cx={p[0]} cy={p[1]} r={hover === i ? 4.5 : 3} fill="var(--surface)" stroke="var(--sage-deep)" strokeWidth="1.5"
          style={{ animation: `fadeUp 400ms ease ${1000 + i * 50}ms both`, pointerEvents: 'none' }} />
        </g>
        )}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
          return (
            <text key={i}
            x={pad.l + i * stepX} y={height - 6}
            textAnchor="middle" fontSize="10"
            fill="var(--text-muted)" fontFamily="var(--font-mono)">
              {d.date.slice(5)}
            </text>);

        })}
        <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-mono)">{max}</text>
        <text x={pad.l - 6} y={pad.t + innerH} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-mono)">0</text>
      </svg>
      {hover != null &&
      <div style={{
        position: 'absolute',
        left: Math.min(w - 140, Math.max(0, points[hover][0] - 60)),
        top: Math.max(0, points[hover][1] - 54),
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '8px 10px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2
      }}>
          <div style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data[hover].date}</div>
          <div style={{ color: 'var(--sage-deep)', fontWeight: 500 }}>{data[hover].count} restocked</div>
        </div>
      }
    </div>);

}

// Diverging bar chart — receipts (up) vs issuances (down) on a shared 0 axis,
// with an optional cumulative qty-on-hand line on a secondary right-hand scale.
function DivergingBarChart({ data, onHandSeries, height = 300, valueFormat = formatNumber, bucketing = 'day' }) {
  const containerRef = useRef(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  if (!data || data.length === 0) {
    return <div ref={containerRef} className="empty-hint">No activity in the selected period.</div>;
  }
  const hasOnHand = onHandSeries && onHandSeries.length === data.length;
  const pad = { l: 46, r: hasOnHand ? 46 : 12, t: 10, b: 28 };
  const innerW = Math.max(100, w - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const maxRecv = Math.max(...data.map((d) => d.received), 1);
  const maxIssue = Math.max(...data.map((d) => d.issued), 1);
  const max = Math.max(maxRecv, maxIssue);
  const mid = pad.t + innerH / 2;
  const halfH = innerH / 2;

  const gap = bucketing === 'month' ? 4 : bucketing === 'week' ? 3 : 1.5;
  const barW = Math.max(2, (innerW - gap * (data.length - 1)) / data.length);

  // Secondary scale for on-hand line — independent of the bar-volume scale.
  const onHandVals = hasOnHand ? onHandSeries.map((d) => d.onHand) : [0];
  const ohMin = Math.min(0, ...onHandVals);
  const ohMax = Math.max(1, ...onHandVals);
  const ohRange = ohMax - ohMin || 1;
  const ohY = (v) => pad.t + innerH - (v - ohMin) / ohRange * innerH;
  const xAt = (i) => pad.l + i * (barW + gap) + barW / 2;

  const formatBucket = (b) => {
    if (bucketing === 'month') return b; // "2025-01"
    if (bucketing === 'week') return b.slice(5); // "01-06"
    return b.slice(5); // "01-06"
  };

  const netTotal = data.reduce((a, d) => a + (d.received - d.issued), 0);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, right: hasOnHand ? 46 : 8,
        display: 'flex', gap: 14, fontSize: 11,
        color: 'var(--text-muted)',
        animation: 'fadeUp 500ms ease 600ms both',
        pointerEvents: 'none', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '70%'
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'oklch(0.68 0.07 145)' }} />
          Received (↑ above 0)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'oklch(0.66 0.10 35)' }} />
          Issued (↓ below 0)
        </span>
        {hasOnHand &&
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 2, borderRadius: 1, background: 'var(--sage-deep)' }} />
          Qty on hand
        </span>
        }
      </div>
      <div style={{
        position: 'absolute', top: 0, left: 0, fontSize: 11,
        fontFamily: 'var(--font-mono)', fontWeight: 500,
        color: netTotal >= 0 ? 'oklch(0.50 0.09 145)' : 'oklch(0.50 0.12 35)',
        animation: 'fadeUp 500ms ease 600ms both',
        whiteSpace: 'nowrap', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>
        Net {netTotal >= 0 ? '+' : '−'}{Math.abs(netTotal).toLocaleString()} this period
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)} style={{ marginTop: 26 }}>
        {/* y-axis ticks — bar-volume scale, magnitude with explicit direction */}
        {[1, 0.5, 0.25].map((t) =>
        <g key={t}>
            <line x1={pad.l} x2={w - pad.r}
          y1={mid - halfH * t} y2={mid - halfH * t}
          stroke="var(--border)" strokeDasharray="2 4" />
            <line x1={pad.l} x2={w - pad.r}
          y1={mid + halfH * t} y2={mid + halfH * t}
          stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={mid - halfH * t + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">
              {valueFormat(Math.round(max * t))}
            </text>
            <text x={pad.l - 6} y={mid + halfH * t + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">
              −{valueFormat(Math.round(max * t))}
            </text>
          </g>
        )}
        {/* 0 axis */}
        <line x1={pad.l} x2={w - pad.r} y1={mid} y2={mid} stroke="var(--border-strong)" />
        <text x={pad.l - 6} y={mid + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-muted)">0</text>

        {/* right-hand on-hand scale */}
        {hasOnHand && [0, 0.5, 1].map((t) =>
        <text key={t} x={w - pad.r + 6} y={pad.t + innerH - innerH * t + 3} textAnchor="start"
          fontSize="10" fontFamily="var(--font-mono)" fill="var(--sage-deep)" opacity="0.8">
            {Math.round(ohMin + ohRange * t)}
          </text>
        )}

        {/* Zero-activity tick rail — a faint mark for EVERY bucket so gaps read as
            genuine zero, not missing data. */}
        {data.map((d, i) => {
          const x = xAt(i);
          return (
            <line key={`tick-${d.bucket}`} x1={x} x2={x} y1={mid - 3} y2={mid + 3}
              stroke="var(--text-faint)" strokeWidth="1" opacity="0.35" />
          );
        })}

        {data.map((d, i) => {
          const x = pad.l + i * (barW + gap);
          const recvH = d.received / max * halfH;
          const issueH = d.issued / max * halfH;
          const isHover = hover === i;
          return (
            <g key={d.bucket}
            onMouseEnter={() => setHover(i)}>
              <rect x={x - 1} y={pad.t} width={barW + 2} height={innerH}
              fill="transparent" pointerEvents="all" />
              {d.received > 0 &&
              <rect x={x} y={mid - recvH} width={barW} height={recvH} rx="1.5"
              fill="oklch(0.68 0.07 145)" opacity={isHover ? 1 : 0.85}
              className="grow-h"
              style={{ transformOrigin: `${x + barW / 2}px ${mid}px`, animationDelay: `${i * 8 + 200}ms` }} />
              }
              {d.issued > 0 &&
              <rect x={x} y={mid} width={barW} height={issueH} rx="1.5"
              fill="oklch(0.66 0.10 35)" opacity={isHover ? 1 : 0.78}
              style={{ transformOrigin: `${x + barW / 2}px ${mid}px`,
                transform: 'scaleY(0)',
                animation: `growDown 700ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 8 + 250}ms both` }} />
              }
            </g>);

        })}

        {/* Qty-on-hand overlay line */}
        {hasOnHand &&
        <>
          <path
            d={onHandSeries.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${ohY(d.onHand)}`).join(' ')}
            stroke="var(--sage-deep)" strokeWidth="2" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            className="draw-line" style={{ '--len': 3000 }} />
          {onHandSeries.map((d, i) =>
          <circle key={i} cx={xAt(i)} cy={ohY(d.onHand)} r={hover === i ? 4 : 2.2}
            fill="var(--surface)" stroke="var(--sage-deep)" strokeWidth="1.5"
            style={{ pointerEvents: 'none' }} />
          )}
        </>
        }

        {/* x-axis labels — show every Nth */}
        {data.map((d, i) => {
          const interval = Math.max(1, Math.ceil(data.length / 8));
          if (i % interval !== 0 && i !== data.length - 1) return null;
          const x = pad.l + i * (barW + gap) + barW / 2;
          return (
            <text key={d.bucket} x={x} y={height - 8} textAnchor="middle"
            fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-muted)">
              {formatBucket(d.bucket)}
            </text>);

        })}
      </svg>

      {hover != null &&
      <div style={{
        position: 'absolute',
        left: Math.min(w - 210, pad.l + hover * (barW + gap) - 60),
        top: 26,
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '8px 10px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
        fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', maxWidth: 230, zIndex: 3
      }}>
          <div style={{ color: 'var(--text)', marginBottom: 4, fontWeight: 500 }}>{data[hover].bucket}</div>
          <div style={{ color: 'oklch(0.55 0.10 145)' }}>+{data[hover].received} received</div>
          <div style={{ color: 'oklch(0.55 0.12 35)' }}>−{data[hover].issued} issued</div>
          {hasOnHand && <div style={{ color: 'var(--sage-deep)', marginTop: 2 }}>{onHandSeries[hover].onHand} on hand</div>}
          {(data[hover].topReceived?.length > 0 || data[hover].topIssued?.length > 0) &&
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontFamily: 'var(--font-ui)' }}>
            {data[hover].topReceived?.slice(0, 3).map((e) =>
            <div key={'r' + e.sku} style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'normal' }}>
              <span style={{ color: 'oklch(0.55 0.10 145)' }}>+{e.received}</span> {e.name} <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{e.sku}</span>
            </div>
            )}
            {data[hover].topIssued?.slice(0, 3).map((e) =>
            <div key={'i' + e.sku} style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'normal' }}>
              <span style={{ color: 'oklch(0.55 0.12 35)' }}>−{e.issued}</span> {e.name} <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{e.sku}</span>
            </div>
            )}
          </div>
          }
        </div>
      }

      <style>{`@keyframes growDown { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
    </div>);

}

// Heatmap matrix — 3×3 building × type
function HeatmapMatrix({ matrix, rows, cols, rowLabel, colLabel, valueKey = 'issued', valueFormat = formatNumber, height = 220 }) {
  const flat = matrix.flat();
  const max = Math.max(...flat.map((c) => c[valueKey]), 1);
  const [hover, setHover] = useState(null); // {ri, ci}
  return (
    <div style={{ position: 'relative' }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: `auto repeat(${cols.length}, 1fr)`,
      gridTemplateRows: `auto repeat(${rows.length}, 1fr)`,
      gap: 6, height,
      fontSize: 12
    }}>
      <div />
      {cols.map((c) =>
      <div key={c} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {colLabel ? colLabel[c] || c : c}
        </div>
      )}
      {rows.map((r, ri) =>
      <React.Fragment key={r}>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {rowLabel ? rowLabel[r] || r : r}
          </div>
          {cols.map((c, ci) => {
          const cell = matrix[ri][ci];
          const v = cell[valueKey];
          const intensity = v / max;
          const bg = v === 0 ?
          'var(--bg-2)' :
          `color-mix(in oklch, oklch(0.66 0.10 35) ${Math.round(20 + intensity * 70)}%, var(--surface-2))`;
          const fg = intensity > 0.5 ? 'white' : 'var(--text)';
          const isHover = hover && hover.ri === ri && hover.ci === ci;
          return (
            <div key={c + ri} className="rise"
              onMouseEnter={() => setHover({ ri, ci })}
              onMouseLeave={() => setHover(null)}
              style={{
              animationDelay: `${(ri * cols.length + ci) * 60}ms`,
              background: bg, color: fg,
              borderRadius: 10, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: 60, cursor: 'pointer',
              outline: isHover ? '2px solid var(--sage-deep)' : 'none',
              outlineOffset: -2
            }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {valueFormat(v)}
                </div>
                <div style={{ fontSize: 10, opacity: 0.75, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  issued
                </div>
              </div>);

        })}
        </React.Fragment>
      )}
    </div>
    {hover &&
    <div style={{
      position: 'absolute', left: 12, bottom: 12,
      background: 'var(--surface)', border: '1px solid var(--border-strong)',
      borderRadius: 8, padding: '8px 10px', fontSize: 12,
      boxShadow: 'var(--shadow-md)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2, maxWidth: 240
    }}>
        <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
          {(rowLabel ? rowLabel[rows[hover.ri]] : rows[hover.ri])} · {(colLabel ? colLabel[cols[hover.ci]] : cols[hover.ci])}
        </div>
        <div style={{ color: 'oklch(0.55 0.10 145)', fontFamily: 'var(--font-mono)' }}>+{matrix[hover.ri][hover.ci].received} received</div>
        <div style={{ color: 'oklch(0.55 0.12 35)', fontFamily: 'var(--font-mono)' }}>−{matrix[hover.ri][hover.ci].issued} issued</div>
        {(matrix[hover.ri][hover.ci].topIssued?.length > 0) &&
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {matrix[hover.ri][hover.ci].topIssued.slice(0, 3).map((e) =>
          <div key={e.sku} style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'normal' }}>
            <span style={{ color: 'oklch(0.55 0.12 35)', fontFamily: 'var(--font-mono)' }}>−{e.issued}</span> {e.name} <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{e.sku}</span>
          </div>
          )}
        </div>
        }
      </div>
    }
    </div>);

}

// Running balance line chart (for SKU detail)
function RunningBalanceChart({ series, height = 200, sku, name }) {
  const containerRef = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  if (!series || series.length < 2) {
    return <div ref={containerRef} className="empty-hint">Not enough data to plot a balance line.</div>;
  }
  const pad = { l: 36, r: 12, t: 14, b: 22 };
  const innerW = Math.max(100, w - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const min = Math.min(0, ...series.map((s) => s.balance));
  const max = Math.max(...series.map((s) => s.balance));
  const range = max - min || 1;
  const minTs = series[0].ts,maxTs = series[series.length - 1].ts;
  const x = (ts) => pad.l + (ts - minTs) / (maxTs - minTs || 1) * innerW;
  const y = (v) => pad.t + innerH - (v - min) / range * innerH;
  const d = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.ts)} ${y(s.balance)}`).join(' ');
  const areaD = d + ` L ${x(maxTs)} ${y(0)} L ${x(minTs)} ${y(0)} Z`;
  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="rbGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) =>
        <g key={t}>
            <line x1={pad.l} x2={w - pad.r}
          y1={pad.t + innerH * t} y2={pad.t + innerH * t}
          stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={pad.t + innerH * t + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">
              {Math.round(max - range * t)}
            </text>
          </g>
        )}
        {min < 0 &&
        <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" />
        }
        <path d={areaD} fill="url(#rbGrad)" style={{ animation: 'fadeUp 800ms ease 400ms both' }} />
        <path d={d} stroke="var(--sage-deep)" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        className="draw-line" style={{ '--len': 4000 }} />
        {series.map((s, i) =>
        <g key={i}>
          <circle cx={x(s.ts)} cy={y(s.balance)} r={12} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
          <circle cx={x(s.ts)} cy={y(s.balance)} r={hover === i ? 4.5 : 2.5} fill="var(--surface)" stroke="var(--sage-deep)" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
        </g>
        )}
      </svg>
      {hover != null &&
      <div style={{
        position: 'absolute',
        left: Math.min(w - 180, Math.max(0, x(series[hover].ts) - 80)),
        top: Math.max(0, y(series[hover].balance) - 92),
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 8, padding: '9px 11px', fontSize: 12,
        boxShadow: 'var(--shadow-md)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2
      }}>
          {sku && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sku}</div>}
          {name && <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{name}</div>}
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{new Date(series[hover].ts).toISOString().slice(0, 10)} · {series[hover].txnType}</div>
          <div style={{ color: series[hover].qty > 0 ? 'oklch(0.50 0.09 145)' : 'oklch(0.50 0.12 35)', fontWeight: 500 }}>
            {series[hover].qty > 0 ? '+' : ''}{series[hover].qty} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>→ balance {series[hover].balance}</span>
          </div>
        </div>
      }
    </div>);

}

Object.assign(window, { CountUp, Sparkline, HBarChart, VBarChart, Donut, LineChart, DivergingBarChart, HeatmapMatrix, RunningBalanceChart });