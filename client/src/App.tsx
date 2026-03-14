import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './pages/Layout';
import ProtectedRoute from './pages/ProtectedRoute';
import AuthLoginPage from './pages/AuthLoginPage';
import AuthRegisterPage from './pages/AuthRegisterPage';
import RacesPage from './pages/RacesPage';
import RaceTicketsPage from './pages/RaceTicketsPage';
import SellPage from './pages/SellPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/races" replace />} />
            <Route path="races" element={<RacesPage />} />
            <Route path="races/:id" element={<RaceTicketsPage />} />
            <Route path="sell" element={<ProtectedRoute><SellPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="auth/login" element={<AuthLoginPage />} />
            <Route path="auth/register" element={<AuthRegisterPage />} />
            <Route path="payment/success" element={<PaymentSuccessPage />} />
            <Route path="payment/cancel" element={<PaymentCancelPage />} />
            <Route path="*" element={<Navigate to="/races" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  );
}

export default App;
