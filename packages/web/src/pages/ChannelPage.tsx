import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatView from '../components/ChatView';

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-gray-700 px-4 py-3 font-semibold text-gray-200">
          # {channelId}
        </div>
        {channelId && <ChatView key={channelId} channelId={channelId} />}
      </main>
    </div>
  );
}
