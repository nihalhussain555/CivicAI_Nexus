import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";

const ProtectedRoute = ({
  children,
  allowedRoles,
  adminScope,
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/403" replace />;
  }

  /*
   * Admin scope:
   *
   * super:
   *   admin + no district
   *
   * district:
   *   admin + district
   */
  if (
    user.role === "admin" &&
    adminScope === "super" &&
    user.district
  ) {
    return (
      <Navigate
        to="/admin/district"
        replace
      />
    );
  }

  if (
    user.role === "admin" &&
    adminScope === "district" &&
    !user.district
  ) {
    return (
      <Navigate
        to="/admin/dashboard"
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;