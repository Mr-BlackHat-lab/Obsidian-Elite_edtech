import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import {
  CheckInboxPage,
  DashboardPage,
  LoginPage,
  NotFoundPage,
  SignupPage,
  VerifyEmailPage,
} from "./pages";

function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <section className="route-loader-card page-appear">
        <div className="spinner" aria-hidden="true" />
        <p>Initializing secure environment...</p>
      </section>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <header className="top-nav page-appear">
        <div className="brand-wrap">
          <span className="brand-kicker">LearnPulse</span>
          <span className="brand-name">Secure Access Portal</span>
        </div>

        <nav className="nav-links" aria-label="Primary">
          {!user ? (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Sign In
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Register
              </NavLink>
            </>
          ) : (
            <NavLink
              to="/dashboard"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              Overview
            </NavLink>
          )}
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
          />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/check-email" element={<CheckInboxPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
