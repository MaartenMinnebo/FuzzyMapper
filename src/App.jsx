import { useState, useEffect, useRef, useCallback } from 'react';
import AuthGate from './components/AuthGate';
import SessionList from './components/SessionList';
import SaveModal from './components/SaveModal';
import MatchingInterface from './components/MatchingInterface';
import { parseCSVFile } from './utils/csvParser';
import { buildFuseIndex, searchMatches } from './utils/fuzzyEngine';
import { createSession, loadSession, updateSession } from './lib/sessions';
import { supabase } from './lib/supabase';
import './App.css';

const STEPS = { HOME: 'home', UPLOAD: 'upload', PRESCAN: 'prescan', MATCH: 'match', DONE: 'done' };

export default function App() {
  return (
    <AuthGate>
      {(session) => <AppInner session={session} />}
    </AuthGate>
  );
}

function AppInner({ session }) {
  const [step, setStep] = useState(STEPS.HOME);
  const [sourceFile, setSourceFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [sourceList, setSourceList] = useState([]);
  const [targetList, setTargetList] = useState([]);
  const [matches, setMatches] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [prescanProgress, setPrescanProgress] = useState(0);
  const [error, setError] = useState('');

  // Upload sources state
  const [srcLoaded, setSrcLoaded] = useState(false);
  const [tgtLoaded, setTgtLoaded] = useState(false);
  const [srcName, setSrcName] = useState('');
  const [tgtName, setTgtName] = useState('');

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // ---- Resume a saved session ----
  async function handleResume(id) {
    try {
      const data = await loadSession(id);
      setSourceList(data.source_list);
      setTargetList(data.target_list);
      setMatches(data.matches);
      setSessionId(data.id);
      setSessionName(data.name);
      setSrcName(data.source_file_name);
      setTgtName(data.target_file_name);
      setStep(STEPS.MATCH);
    } catch (e) {
      alert('Laden mislukt: ' + e.message);
    }
  }

  // ---- Start new session flow ----
  async function handleStart() {
    if (!sourceFile || !targetFile) return;
    setError('');

    try {
      const [src, tgt] = await Promise.all([parseCSVFile(sourceFile), parseCSVFile(targetFile)]);
      if (!src.length || !tgt.length) {
        setError('Een of beide bestanden zijn leeg of hebben geen herkende kolommen.');
        return;
      }

      // Build fuse + pre-tokenize
      const fuse = buildFuseIndex(tgt);

      setStep(STEPS.PRESCAN);
      setPrescanProgress(0);

      // Chunked pre-scan
      const batchSize = 100;
      for (let i = 0; i < src.length; i += batchSize) {
        const end = Math.min(i + batchSize, src.length);
        for (let j = i; j < end; j++) {
          const item = src[j];
          const query = (item.omschrijving || '').trim();
          item._cachedResults = query ? searchMatches(query, tgt, fuse, { threshold: 0.4, maxResults: 5 }) : [];
          item._bestScore = item._cachedResults[0]?.score || 0;
        }
        setPrescanProgress(Math.round((end / src.length) * 100));
        await new Promise(r => setTimeout(r, 0));
      }

      // Sort: 0-match first, then by best score descending
      src.sort((a, b) => {
        const aC = a._cachedResults.length, bC = b._cachedResults.length;
        if (aC === 0 && bC === 0) return 0;
        if (aC === 0) return -1;
        if (bC === 0) return 1;
        return b._bestScore - a._bestScore;
      });

      setSourceList(src);
      setTargetList(tgt);
      setMatches({});
      setSessionId(null);
      setSessionName('');
      setSrcName(sourceFile.name);
      setTgtName(targetFile.name);
      setStep(STEPS.MATCH);
    } catch (e) {
      setError('Fout: ' + e.message);
      setStep(STEPS.UPLOAD);
    }
  }

  // ---- Save session ----
  async function handleSave(name) {
    try {
      const matchedCount = Object.values(matches).filter(x => x.item !== null).length;
      if (sessionId) {
        await updateSession(sessionId, { matches, matchedCount, sourceList });
        setSessionName(name);
      } else {
        const id = await createSession({
          name,
          sourceFileName: srcName,
          targetFileName: tgtName,
          sourceList,
          targetList,
          matches,
          total: sourceList.length,
          matchedCount,
        });
        setSessionId(id);
        setSessionName(name);
      }
      setShowSaveModal(false);
    } catch (e) {
      alert('Opslaan mislukt: ' + e.message);
    }
  }

  // ---- Export CSV ----
  function exportCSV() {
    const rows = [['source_uuid', 'source_omschrijving', 'target_uuid', 'target_omschrijving', 'status']];
    for (const item of sourceList) {
      const m = matches[item.uuid];
      if (!m) continue;
      const t = m.item;
      rows.push([
        item.uuid, item.omschrijving,
        t?.uuid || '', t?.omschrijving || '',
        t ? 'matched' : 'no_match',
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fuzzymapper_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- Stats for done view ---
  const matched = Object.values(matches).filter(x => x.item !== null).length;
  const total = sourceList.length;
  const noMatch = Object.values(matches).filter(x => x.item === null).length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>
        <div className="header-text">
          <h1>FuzzyMapper</h1>
          {sessionName && <span className="session-badge">{sessionName}</span>}
        </div>
        <div className="header-steps">
          <div className={`step ${step === STEPS.HOME ? 'active' : step !== STEPS.HOME ? 'done' : ''}`}>1</div>
          <div className="step-line" />
          <div className={`step ${step === STEPS.MATCH || step === STEPS.PRESCAN ? 'active' : step === STEPS.DONE ? 'done' : ''}`}>2</div>
          <div className="step-line" />
          <div className={`step ${step === STEPS.DONE ? 'active' : ''}`}>3</div>
        </div>
        <button className="btn-secondary btn-sm logout-btn" onClick={handleLogout} title="Uitloggen">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Uitloggen
        </button>
      </header>

      <main className="app-main">
        {/* HOME: session list */}
        {step === STEPS.HOME && (
          <SessionList
            onResume={handleResume}
            onNewSession={() => setStep(STEPS.UPLOAD)}
          />
        )}

        {/* UPLOAD */}
        {step === STEPS.UPLOAD && (
          <div className="upload-view">
            <button className="back-link" onClick={() => setStep(STEPS.HOME)}>
              ← Terug naar taken
            </button>
            <div className="upload-grid">
              <UploadZone label="Bronlijst" name={srcName} onFile={f => { setSourceFile(f); setSrcName(f.name); setSrcLoaded(true); }} />
              <div className="upload-arrow">
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              <UploadZone label="Doellijst" name={tgtName} onFile={f => { setTargetFile(f); setTgtName(f.name); setTgtLoaded(true); }} />
            </div>
            <p className="upload-hint">Vereiste kolommen: <code>uuid</code> en <code>omschrijving</code></p>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-primary start-btn" disabled={!srcLoaded || !tgtLoaded} onClick={handleStart}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
              Start koppeling
            </button>
          </div>
        )}

        {/* PRESCAN */}
        {step === STEPS.PRESCAN && (
          <div className="prescan-view">
            <div className="prescan-card glass">
              <div className="spin-icon">
                <svg className="spin" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
              </div>
              <div className="prescan-label">Bezig met voor-scannen... {prescanProgress}%</div>
              <div className="pbar-track"><div className="pbar-fill" style={{ width: prescanProgress + '%' }} /></div>
            </div>
          </div>
        )}

        {/* MATCH */}
        {step === STEPS.MATCH && (
          <>
            <MatchingInterface
              sourceList={sourceList}
              targetList={targetList}
              initialMatches={matches}
              sessionId={sessionId}
              sessionName={sessionName}
              onSaveRequest={(m) => { setMatches(m); setShowSaveModal(true); }}
              onShowResults={(m) => { setMatches(m); setStep(STEPS.DONE); }}
              onBackToHome={(m) => { setMatches(m); setStep(STEPS.HOME); }}
            />
            {showSaveModal && (
              <SaveModal
                defaultName={sessionName}
                onSave={handleSave}
                onCancel={() => setShowSaveModal(false)}
              />
            )}
          </>
        )}

        {/* DONE */}
        {step === STEPS.DONE && (
          <div className="done-view">
            <div className="done-icon">
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="done-title">Koppeling voltooid!</h2>
            <p className="done-sub">{matched} gematched · {noMatch} geen match · {total - matched - noMatch} overgeslagen</p>
            <div className="done-preview glass">
              {sourceList.slice(0, 6).filter(i => matches[i.uuid]).map(item => {
                const m = matches[item.uuid];
                return (
                  <div key={item.uuid} className={`preview-row ${m.item ? 'preview-matched' : 'preview-nomatch'}`}>
                    <span>{item.omschrijving}</span>
                    <span>→</span>
                    <span>{m.item?.omschrijving || '(geen match)'}</span>
                  </div>
                );
              })}
            </div>
            <div className="done-actions">
              <button className="btn-secondary" onClick={() => setStep(STEPS.MATCH)}>← Terug naar koppelen</button>
              <button className="btn-secondary" onClick={() => setStep(STEPS.HOME)}>Takenoverzicht</button>
              <button className="btn-primary" onClick={exportCSV}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exporteer CSV
              </button>
            </div>
          </div>
        )}
      </main>
      <div className="info-footer">
        <div className="info-icon">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="info-tooltip glass">
            FuzzyMapper made by Maarten Minnebo - 2026 Poapegoajewerk for noobs
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Upload Zone Component ----
function UploadZone({ label, name, onFile }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);

  const handle = useCallback(f => { if (f) onFile(f); }, [onFile]);

  return (
    <div
      className={`upload-zone glass${drag ? ' dragover' : ''}${name ? ' loaded' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
    >
      <svg width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span className="zone-label">{label}</span>
      <span className="zone-hint">{name || 'Sleep CSV hier of klik om te selecteren'}</span>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handle(e.target.files[0])} />
    </div>
  );
}
