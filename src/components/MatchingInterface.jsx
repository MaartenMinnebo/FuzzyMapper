import { useState, useEffect, useRef, useCallback } from 'react';
import { buildFuseIndex, searchMatches } from '../utils/fuzzyEngine';
import { updateSession } from '../lib/sessions';

const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- Icons ----
const IconCheck = () => (
  <svg width="14" height="14" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" fill="none" stroke="var(--danger)" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function MatchingInterface({
  sourceList: initialSourceList,
  targetList,
  initialMatches = {},
  sessionId = null,
  sessionName = '',
  maxResults: initialMaxResults = 5,
  threshold: initialThreshold = 0.40,
  onSaveRequest,
  onShowResults,
  onBackToHome,
}) {
  const [sourceList, setSourceList] = useState(initialSourceList);
  const [matches, setMatches] = useState(initialMatches);
  const [currentItem, setCurrentItem] = useState(null);
  const [results, setResults] = useState([]);
  const [maxResults, setMaxResults] = useState(initialMaxResults);
  const [threshold] = useState(initialThreshold);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fuseRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // Build fuse index once
  useEffect(() => {
    fuseRef.current = buildFuseIndex(targetList);
  }, [targetList]);

  // Auto-advance to first unmatched item
  useEffect(() => {
    if (fuseRef.current && sourceList.length > 0 && !currentItem) {
      advanceToNext(null, sourceList, matches);
    }
  }, [fuseRef.current]);

  function advanceToNext(fromItem, sl = sourceList, m = matches) {
    const idx = fromItem ? sl.findIndex(s => s.uuid === fromItem.uuid) : -1;
    const next = sl.slice(idx + 1).find(s => !(s.uuid in m));
    if (next) {
      selectItem(next, sl, m);
    } else {
      setCurrentItem(null);
      setResults([]);
    }
  }

  function selectItem(item, sl = sourceList, m = matches) {
    setCurrentItem(item);

    // Use cache if available
    let res = item._cachedResults;
    if (!res) {
      const query = (item.omschrijving || '').trim();
      res = query ? searchMatches(query, targetList, fuseRef.current, { threshold, maxResults }) : [];
      // Cache
      item._cachedResults = res;
    }

    if (res.length === 0) {
      // Auto no-match
      const newMatches = { ...m, [item.uuid]: { item: null } };
      setMatches(newMatches);
      scheduleAutoSave(sl, newMatches);
      setTimeout(() => advanceToNext(item, sl, newMatches), 0);
      return;
    }

    setResults(res.slice(0, maxResults));
  }

  function confirmMatch(targetItem) {
    if (!currentItem) return;
    const newMatches = { ...matches, [currentItem.uuid]: { item: targetItem } };
    setMatches(newMatches);
    scheduleAutoSave(sourceList, newMatches);
    advanceToNext(currentItem, sourceList, newMatches);
  }

  function setNoMatch() {
    if (!currentItem) return;
    const newMatches = { ...matches, [currentItem.uuid]: { item: null } };
    setMatches(newMatches);
    scheduleAutoSave(sourceList, newMatches);
    advanceToNext(currentItem, sourceList, newMatches);
  }

  function scheduleAutoSave(sl, m) {
    if (!sessionId) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const matchedCount = Object.values(m).filter(x => x.item !== null).length;
      updateSession(sessionId, {
        matches: m,
        matchedCount,
        sourceList: sl,
      }).catch(console.error);
    }, 1500);
  }

  // Stats
  const total = sourceList.length;
  const done = Object.keys(matches).length;
  const matchedCount = Object.values(matches).filter(x => x.item !== null).length;
  const noMatchCount = done - matchedCount;
  const remaining = total - done;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="matching-view">
      {/* Top bar */}
      <div className="match-topbar">
        <div className="progress-stats">
          <span className="stat-success">✓ {matchedCount} gematched</span>
          <span className="stat-danger">✗ {noMatchCount} geen match</span>
          <span className="stat-muted">{remaining} resterend</span>
          <button className="btn-secondary btn-sm settings-toggle" onClick={() => setSettingsOpen(s => !s)}>
            ⚙ Instellingen
          </button>
          <button className="btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={onSaveRequest}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            {sessionId ? 'Opgeslagen ✓' : 'Opslaan'}
          </button>
          <button className="btn-primary btn-sm" onClick={onShowResults}>Toon resultaten</button>
        </div>
        {settingsOpen && (
          <div className="settings-bar">
            <label className="setting-label">
              Max resultaten:
              <input className="setting-input" type="number" min={1} max={20} value={maxResults} onChange={e => setMaxResults(+e.target.value || 1)} />
            </label>
          </div>
        )}
        <div className="pbar-track"><div className="pbar-fill" style={{ width: pct + '%' }} /></div>
      </div>

      <div className="interface-body">
        {/* Source list */}
        <div className="source-panel glass">
          <div className="panel-header">
            <h3>Bronlijst <span className="count-badge">{total}</span></h3>
          </div>
          <div className="source-list">
            {sourceList.map(item => {
              const isMatched = item.uuid in matches;
              const val = matches[item.uuid];
              const isActive = currentItem?.uuid === item.uuid;
              return (
                <div
                  key={item.uuid}
                  className={`source-item${isMatched ? (val?.item ? ' matched' : ' nomatch') : ''}${isActive ? ' active' : ''}`}
                  onClick={() => selectItem(item)}
                >
                  <div className="source-item-body">
                    <div className="source-item-desc">{item.omschrijving || '(leeg)'}</div>
                    <div className="source-item-uuid">{item.uuid}</div>
                  </div>
                  <div className="source-item-icon">
                    {isMatched ? (val?.item ? <IconCheck /> : <IconX />) : <IconSearch />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Match panel */}
        <div className="match-panel glass">
          {!currentItem ? (
            <div className="no-selection">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" opacity="0.3">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p>Selecteer een item uit de bronlijst<br />of alle items zijn verwerkt.</p>
              {remaining === 0 && (
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={onShowResults}>
                  Toon resultaten &amp; exporteer
                </button>
              )}
            </div>
          ) : (
            <div className="match-content">
              <div className="panel-header">
                <h3>Matches voor:</h3>
              </div>
              <div className="selected-query glass-inner">
                <div className="query-desc">{currentItem.omschrijving}</div>
                <div className="query-uuid">{currentItem.uuid}</div>
              </div>
              <div className="results-header">
                <span className="results-label">Resultaten ({results.length})</span>
                <button className="btn-no-match" onClick={setNoMatch}>✗ Geen match</button>
              </div>
              <div className="results-list">
                {results.map((r, idx) => {
                  const pct = Math.round(r.score * 100);
                  const color = pct >= 70 ? 'var(--success)' : pct >= 45 ? 'var(--warn)' : 'var(--danger)';
                  return (
                    <div key={r.item.uuid} className="result-card" onClick={() => confirmMatch(r.item)}>
                      <div className="result-card-left">
                        <span className="result-rank">#{idx + 1}</span>
                        <div className="result-texts">
                          <div className="result-desc">{r.item.omschrijving}</div>
                          <div className="result-uuid">{r.item.uuid}</div>
                        </div>
                      </div>
                      <div className="result-score" style={{ color }}>
                        {pct}%
                        <button className="btn-select" onClick={e => { e.stopPropagation(); confirmMatch(r.item); }}>
                          Kies dit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
