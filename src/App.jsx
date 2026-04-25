import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 24, background: '#fff', color: '#c00', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 13 }}>
        <b>Render error — check console for full stack</b>{'\n\n'}
        {this.state.error.message}{'\n\n'}
        {this.state.error.stack}
      </div>
    );
    return this.props.children;
  }
}
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
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
