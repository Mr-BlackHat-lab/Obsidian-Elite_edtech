import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, badge, children, footer }: AuthLayoutProps) {
  return (
    <section className="auth-card page-appear">
      {badge ? <span className="auth-badge">{badge}</span> : null}
      <h1 className="auth-title">{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      <div className="auth-content">{children}</div>
      {footer ? <div className="auth-footer">{footer}</div> : null}
    </section>
  );
}
