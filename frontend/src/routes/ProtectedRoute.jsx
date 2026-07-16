import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Guards a subtree of routes.
 * - Not logged in -> redirect to /login
 * - Logged in but role not allowed -> redirect to /unauthorized
 * @param {{ allowedRoles?: string[] }} props
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, accessToken, status } = useSelector((state) => state.auth);
  const location = useLocation();

  // Still resolving the session on first load (e.g. silent refresh in-flight)
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
