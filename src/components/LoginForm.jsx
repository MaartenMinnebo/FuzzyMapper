import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginForm() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setDone('Bevestigingsmail verzonden! Controleer je inbox en klik op de link om je account te activeren.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="logo">
          <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>
        <h1 className="auth-title">FuzzyMapper</h1>
        <p className="auth-sub">Intelligente instrumentkoppeling</p>

        <div className="auth-tabs">
          <button className={`auth-tab${mode === 'login' ? ' active' : ''}`} onClick={() => { setMode('login'); setError(''); setDone(''); }}>Inloggen</button>
          <button className={`auth-tab${mode === 'register' ? ' active' : ''}`} onClick={() => { setMode('register'); setError(''); setDone(''); }}>Registreren</button>
        </div>

        {done ? (
          <div className="auth-success">{done}</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label">
              E-mailadres
              <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className="auth-label">
              Wachtwoord
              <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary auth-btn" type="submit" disabled={loading}>
              {loading ? 'Bezig...' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
