import { useState } from 'react';

export default function SaveModal({ defaultName = '', onSave, onCancel }) {
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave(name.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card glass" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Taak opslaan</h3>
        <p className="modal-sub">Geef deze matching-taak een herkenbare naam.</p>
        <form onSubmit={handleSave}>
          <input
            className="auth-input modal-input"
            type="text"
            placeholder="bv. Leveranciers Q1 2025"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
          />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Annuleren</button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
