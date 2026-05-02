import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, hasToken, setToken } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasToken()) navigate('/channels/general', { replace: true });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.register(username.trim());
      setToken(token);
      navigate('/channels/general', { replace: true });
    } catch (err: unknown) {
      setError((err as { status?: number }).status === 409 ? 'Username already taken' : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-sm rounded-xl bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-white">Join Lousse</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Pick a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  );
}
