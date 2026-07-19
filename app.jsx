// app.jsx — root component, schema-aware routing, Tweaks integration
const { useState: useState_a, useEffect: useEffect_a } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "sage",
  "density": "balanced",
  "dark": false
}/*EDITMODE-END*/;

function App() {
  const [loaded, setLoaded] = useState_a(null); // { schema, rows }
  const [fileName, setFileName] = useState_a('');
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect_a(() => {
    document.body.dataset.palette = t.palette;
    document.body.dataset.density = t.density;
    document.body.dataset.theme = t.dark ? 'dark' : 'light';
  }, [t.palette, t.density, t.dark]);

  const handleData = (result, name) => {
    setLoaded(result);
    setFileName(name);
  };
  const handleReset = () => { setLoaded(null); setFileName(''); };

  let screen;
  if (!loaded) {
    screen = <Upload onData={handleData} />;
  } else if (loaded.schema === 'transactional') {
    screen = <TxnDashboard txns={loaded.rows} fileName={fileName} onReset={handleReset} />;
  } else {
    screen = <Dashboard rows={loaded.rows} fileName={fileName} onReset={handleReset} />;
  }

  return (
    <>
      {screen}
      <TweaksPanel>
        <TweakSection label="Palette">
          <TweakRadio
            label="Theme"
            value={t.palette}
            onChange={(v) => setTweak('palette', v)}
            options={[
              { value: 'sage', label: 'Sage' },
              { value: 'blue', label: 'Blue' },
              { value: 'earth', label: 'Earth' },
              { value: 'navy', label: 'Navy' }
            ]}
          />
          <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'spacious', label: 'Spacious' }
            ]}
          />
        </TweakSection>
        <TweakSection label="Data">
          <TweakButton label="Try sample (snapshot)"
            onClick={() => handleData({ schema: 'snapshot', rows: SAMPLE_DATA }, 'sample_inventory.xlsx')} />
          <TweakButton label="Return to upload" secondary onClick={handleReset} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
