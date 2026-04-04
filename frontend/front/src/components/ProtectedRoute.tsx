import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <section className="route-loader-card page-appear">
        <div className="spinner" aria-hidden="true" />
        <p>Restoring your session...</p>
      </section>
    );
  }

  if (!user) {
    // TEMPORARY: disabled auth redirect
    // return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
