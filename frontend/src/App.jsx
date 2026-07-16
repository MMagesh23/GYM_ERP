import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import UnauthorizedPage from './pages/Auth/UnauthorizedPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import MembersPage from './pages/Members/MembersPage';
import MemberProfilePage from './pages/Members/MemberProfilePage';
import PlansPage from './pages/Memberships/PlansPage';
import PaymentsPage from './pages/Payments/PaymentsPage';
import ExpensesPage from './pages/Expenses/ExpensesPage';
import EquipmentPage from './pages/Equipment/EquipmentPage';
import EquipmentDetailPage from './pages/Equipment/EquipmentDetailPage';
import StaffPage from './pages/Staff/StaffPage';
import ReportsPage from './pages/Reports/ReportsPage';
import AuditLogsPage from './pages/AuditLogs/AuditLogsPage';
import { fetchCurrentUser } from './redux/slices/authSlice';

// Placeholder pages for modules built in later phases
const ComingSoon = ({ title }) => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="mt-1 text-sm text-gray-500">This module will be built in an upcoming phase.</p>
  </div>
);

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Attempt a silent session restore on first load using the httpOnly refresh cookie
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<MemberProfilePage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/equipment/:id" element={<EquipmentDetailPage />} />

            {/* Admin-only routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/membership-plans" element={<PlansPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/settings" element={<ComingSoon title="Settings" />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
