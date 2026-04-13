import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';

type Status = 'idle' | 'loading' | 'sent' | 'error';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      await authApi.forgotPassword(email);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div>
        <h1>Check your email</h1>
        <p>If <strong>{email}</strong> is registered, a reset link is on its way.</p>
        <Link to="/login">Back to login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Forgot password</h1>
      {status === 'error' && (
        <p style={{ color: 'red' }}>Something went wrong. Please try again.</p>
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        required
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending...' : 'Send reset link'}
      </button>
      <Link to="/login">Back to login</Link>
    </form>
  );
}
