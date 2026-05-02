import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type Channel } from '../api';

export default function Sidebar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.listChannels().then(setChannels);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const ch = await api.createChannel(newName.trim().toLowerCase());
      setChannels((prev) => [...prev, { ...ch, createdBy: '' }]);
      setNewName('');
      setCreating(false);
    } catch (err: unknown) {
      setError((err as { status?: number }).status === 409 ? 'Name already taken' : 'Failed to create');
    }
  }

  return (
    <div className="flex h-full w-56 shrink-0 flex-col bg-gray-800">
      <div className="border-b border-gray-700 px-4 py-3 text-lg font-bold text-white">Lousse</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {channels.map((ch) => (
          <NavLink
            key={ch.id}
            to={`/channels/${ch.id}`}
            className={({ isActive }) =>
              `block rounded px-2 py-1 text-sm ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`
            }
          >
            # {ch.name}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-700 p-3">
        {creating ? (
          <form onSubmit={handleCreate} className="space-y-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="channel-name"
              className="w-full rounded bg-gray-700 px-2 py-1 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-1">
              <button type="submit" className="flex-1 rounded bg-indigo-600 py-1 text-xs text-white hover:bg-indigo-500">
                Add
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setError(''); setNewName(''); }}
                className="flex-1 rounded bg-gray-600 py-1 text-xs text-white hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full rounded px-2 py-1 text-left text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            + New channel
          </button>
        )}
      </div>
    </div>
  );
}
