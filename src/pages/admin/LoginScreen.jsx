import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase.js';
import { ADMIN_EMAIL } from './helpers.js';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    if (!auth) {
      setError('Firebase not configured. Please set up Firebase first.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      setError('');
      // The auth listener in AdminPage swaps in the dashboard.
    } catch (err) {
      console.error('Login error:', err);
      let message = 'Incorrect password. Contact the library lead if you need access.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Incorrect password.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      }
      setError(message);
      setPassword('');
    }
  }

  return (
    <section className="login-screen" style={{ display: 'flex' }}>
      <div className="login-card">
        <div className="eyebrow">Volunteer Access</div>
        <h1>Admin Login</h1>
        <p>Enter the admin password to manage the library.</p>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>Sign in</button>
          <div className="login-error">{error}</div>
        </form>
      </div>
    </section>
  );
}
