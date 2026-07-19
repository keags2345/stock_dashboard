// upload.jsx — landing screen with drag/drop upload + sample data
const { useState: useState_u, useCallback } = React;

function Upload({ onData }) {
  const [over, setOver] = useState_u(false);
  const [error, setError] = useState_u(null);
  const [loading, setLoading] = useState_u(false);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const result = await parseFile(file);
      if (!result.rows || result.rows.length === 0) {
        setError("That file looks empty. Try another one.");
        setLoading(false);
        return;
      }
      // Small delay so the loading state is perceptible
      setTimeout(() => onData(result, file.name), 280);
    } catch (e) {
      console.error(e);
      setError("Couldn't read that file. Make sure it's a valid .xlsx or .csv.");
      setLoading(false);
    }
  }, [onData]);

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="rise" style={{ display: 'inline-block' }}>
          <span className="eyebrow">
            <span className="pulse" />
            INVENTORY ANALYTICS
          </span>
        </div>
        <h1 className="rise" style={{ animationDelay: '120ms' }}>
          Drop a spreadsheet.<br />
          See your inventory <em>clearly</em>.
        </h1>
        <p className="sub rise" style={{ animationDelay: '220ms' }}>
          Stockwise reads your Excel or CSV file in the browser, detects the columns,
          and renders a calm, animated dashboard. Nothing leaves your device.
        </p>

        <div
          className={`dropzone rise ${over ? 'over' : ''}`}
          style={{ animationDelay: '320ms' }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('file-input').click()}
        >
          <div className="icon">
            {loading ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
                </path>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="big">
            {loading ? 'Reading your file…' : 'Drop your inventory file here'}
          </div>
          <div className="small">
            or <u>browse</u> — supports .xlsx, .xls and .csv
          </div>
          <input id="file-input" type="file" accept=".xlsx,.xls,.csv" hidden onChange={onPick} />
        </div>

        {error && (
          <div className="fade-up" style={{ color: 'var(--danger)', marginTop: 14, fontSize: 13 }}>{error}</div>
        )}

        <div className="actions-row rise" style={{ animationDelay: '420ms' }}>
          <button className="btn" onClick={() => onData({ schema: 'snapshot', rows: SAMPLE_DATA }, 'sample_inventory.xlsx')}>
            Try with sample data →
          </button>
        </div>

        <div className="specs rise" style={{ animationDelay: '520ms' }}>
          <div className="spec">
            <div className="k">TRANSACTIONAL SCHEMA</div>
            <div className="v">Transaction Date · Type · SKU · Item · Unit Cost · Change of Quantity</div>
          </div>
          <div className="spec">
            <div className="k">PRIVACY</div>
            <div className="v">Parsed entirely in your browser. No upload, no server.</div>
          </div>
          <div className="spec">
            <div className="k">SKU FORMAT</div>
            <div className="v">Building (T1/T2/SM) + Trade (EL/BL/PL) + ID, e.g. <span style={{fontFamily:'var(--font-mono)'}}>T2EL0011</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Upload = Upload;
