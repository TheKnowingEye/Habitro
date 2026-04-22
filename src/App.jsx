import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
  return user ? children : <Navigate to="/onboarding" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
