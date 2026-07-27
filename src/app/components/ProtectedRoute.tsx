import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useShallow } from 'zustand/react/shallow';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('pengajar' | 'pengurus')[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore(
    useShallow((s) => ({ isAuthenticated: s.isAuthenticated, user: s.user }))
  );

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check role authorization
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    const redirectPath =
      user.role === 'pengajar' ? '/pengajar/dashboard' : '/pengurus/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  // Block normal routes if password needs changing
  if (user.mustChangePassword) {
    return <Navigate to="/ganti-password" replace />;
  }

  return <>{children}</>;
}
