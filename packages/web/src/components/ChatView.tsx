import { useEffect, useRef, useState } from 'react';
import { api, wsUrl, type Message } from '../api';

interface DisplayMessage extends Message {
  isSystem?: boolean;
}

export default function ChatView({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    api.getMessages(channelId).then((msgs) => {
      setMessages([...msgs].reverse());
      setHasMore(msgs.length === 50);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });
  }, [channelId]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(channelId));
    wsRef.current = ws;

    ws.onmessage = (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { type: string } & DisplayMessage & { user: { id: string; username: string } };

      if (data.type === 'message') {
        setMessages((prev) => [...prev, data]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else if (data.type === 'user_joined' || data.type === 'user_left') {
        const label = data.type === 'user_joined' ? 'joined' : 'left';
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            content: `${data.user.username} ${label}`,
            createdAt: Math.floor(Date.now() / 1000),
            user: data.user,
            isSystem: true,
          },
        ]);
      }
    };

    return () => ws.close();
  }, [channelId]);

  async function loadMore() {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const older = await api.getMessages(channelId, oldest.id);
    setHasMore(older.length === 50);
    setMessages((prev) => [...[...older].reverse(), ...prev]);
    setLoadingMore(false);
  }

  function handleScroll() {
    if (feedRef.current?.scrollTop === 0) void loadMore();
  }

  function send() {
    const content = input.trim();
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'message', content }));
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={feedRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loadingMore && <p className="text-center text-xs text-gray-500">Loading...</p>}
        {messages.map((msg) =>
          msg.isSystem ? (
            <p key={msg.id} className="text-center text-xs text-gray-500">
              {msg.content}
            </p>
          ) : (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-indigo-400">{msg.user.username}</span>
                <span className="text-xs text-gray-500">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="break-words text-sm text-gray-100">{msg.content}</p>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-700 p-3">
        <div className="flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelId}`}
            className="flex-1 resize-none rounded-lg bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
