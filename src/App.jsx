import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import HabitSelection from './pages/HabitSelection';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import EvidenceFeed from './pages/EvidenceFeed';
import BattleResult from './pages/BattleResult';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Dashboard /> : <Landing />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/habits" element={<ProtectedRoute><HabitSelection /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
      <Route path="/evidence" element={<ProtectedRoute><EvidenceFeed /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><BattleResult /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
