import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { hasToken } from './api';
import LoginPage from './pages/LoginPage';
import ChannelPage from './pages/ChannelPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return hasToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/channels/general" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/channels/:channelId"
          element={
            <RequireAuth>
              <ChannelPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
