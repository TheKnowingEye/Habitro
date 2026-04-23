import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';

export default function Onboarding() {
  const navigate = useNavigate();
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else {
        setInfo('Check your email for a confirmation link, then sign in.');
        setMode('signin');
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⚔️</div>
        <h1 style={styles.title}>HabitDuel</h1>
        <p style={styles.subtitle}>Compete weekly. Build habits that stick.</p>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === 'signin' ? styles.tabActive : {}) }}
            onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
          >
            Sign in
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'signup' ? styles.tabActive : {}) }}
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error && <p style={styles.error}>{error}</p>}
          {info  && <p style={styles.info}>{info}</p>}

          <div style={styles.submit}>
            <Button type="submit" variant="primary" loading={loading}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'var(--color-bg)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logo: {
    fontSize: 40,
    textAlign: 'center',
  },
  title: {
    fontSize: 'var(--font-2xl)',
    fontWeight: 700,
    textAlign: 'center',
    color: 'var(--color-text)',
  },
  subtitle: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    marginBottom: 8,
  },
  tabs: {
    display: 'flex',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--font-md)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  tabActive: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    marginBottom: -4,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-md)',
    outline: 'none',
    transition: 'border-color var(--transition)',
  },
  error: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-error)',
    textAlign: 'center',
  },
  info: {
    fontSize: 'var(--font-sm)',
    color: 'var(--color-success)',
    textAlign: 'center',
  },
  submit: {
    marginTop: 8,
    width: '100%',
  },
};
