import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Registration failed. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Join FeastFite</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        required
        minLength={3}
        maxLength={20}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        minLength={8}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>
      <Link to="/login">Already have an account?</Link>
    </form>
  );
}
