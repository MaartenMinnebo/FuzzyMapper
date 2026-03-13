import React, { useEffect, useRef } from 'react';
import { Check, X, ChevronRight } from 'lucide-react';
import './MatchResults.css';

const ScoreBar = ({ score }) => {
  const pct = Math.round(parseFloat(score) * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="score-pct" style={{ color }}>{pct}%</span>
    </div>
  );
};

const MatchResults = ({ results, onSelect, onNoMatch }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [results]);

  if (!results) return null;

  return (
    <div className="match-results" ref={containerRef}>
      <div className="results-header">
        <span className="results-title">
          <ChevronRight size={14} /> Resultaten ({results.length})
        </span>
        <button className="btn-no-match" onClick={onNoMatch}>
          <X size={14} /> Geen match
        </button>
      </div>
      {results.length === 0 ? (
        <div className="no-results">Geen resultaten gevonden</div>
      ) : (
        results.map((result, idx) => (
          <div
            key={result.item.uuid + idx}
            className="result-card"
            onClick={() => onSelect(result)}
          >
            <div className="result-card-info">
              <span className="result-rank">#{idx + 1}</span>
              <div className="result-texts">
                <p className="result-description">{result.item.omschrijving}</p>
                <p className="result-uuid">UUID: {result.item.uuid}</p>
              </div>
            </div>
            <div className="result-card-score">
              <ScoreBar score={result.score} />
              <button className="btn-select">
                <Check size={14} /> Selecteer
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MatchResults;
