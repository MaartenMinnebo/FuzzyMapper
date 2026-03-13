import { useState, useEffect } from 'react';
import { listSessions, deleteSession } from '../lib/sessions';

function ProgressBadge({ total, matched }) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return (
    <div className="session-progress">
      <div className="session-pbar-track">
        <div className="session-pbar-fill" style={{ width: pct + '%' }} />
      </div>
      <span className="session-pct">{matched}/{total} ({pct}%)</span>
    </div>
  );
}

export default function SessionList({ onResume, onNewSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Taak "${name}" verwijderen?`)) return;
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="session-list-wrap">
      <div className="session-list-header">
        <h2 className="session-list-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Opgeslagen taken
        </h2>
        <button className="btn-primary btn-sm" onClick={onNewSession}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nieuwe taak
        </button>
      </div>

      {loading ? (
        <div className="session-loading">Laden...</div>
      ) : sessions.length === 0 ? (
        <div className="session-empty">Nog geen opgeslagen taken. Maak een nieuwe taak aan!</div>
      ) : (
        <div className="session-cards">
          {sessions.map(s => (
            <div key={s.id} className="session-card glass">
              <div className="session-card-body">
                <div className="session-name">{s.name}</div>
                <div className="session-files">
                  <span className="session-tag">{s.source_file_name}</span>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                  <span className="session-tag">{s.target_file_name}</span>
                </div>
                <ProgressBadge total={s.total} matched={s.matched_count} />
                <div className="session-date">
                  Opgeslagen: {new Date(s.updated_at).toLocaleString('nl-BE')}
                </div>
              </div>
              <div className="session-card-actions">
                <button className="btn-primary btn-sm" onClick={() => onResume(s.id)}>
                  Verder gaan
                </button>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => handleDelete(s.id, s.name)}
                  disabled={deletingId === s.id}
                >
                  {deletingId === s.id ? '...' : 'Verwijderen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
