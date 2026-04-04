import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="auth-card page-appear">
      <span className="auth-badge">404</span>
      <h1 className="auth-title">Page not found</h1>
      <p className="auth-subtitle">The page you are looking for does not exist.</p>
      <div className="auth-content">
        <Link to="/login" className="button-primary button-link-like">
          Back to login
        </Link>
      </div>
    </section>
  );
}
