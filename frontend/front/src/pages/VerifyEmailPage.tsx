import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { verifyEmail } from "../lib/api";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const loginPath = "/login";

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing from the URL.");
      return;
    }

    let canceled = false;

    const verify = async () => {
      try {
        await verifyEmail(token);

        if (!canceled) {
          setStatus("success");
          setMessage("Email verified successfully. You can now login.");
        }
      } catch (error) {
        if (!canceled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Email verification failed");
        }
      }
    };

    void verify();

    return () => {
      canceled = true;
    };
  }, [searchParams]);

  return (
    <AuthLayout
      badge="Verification"
      title="Email verification"
      subtitle="We are validating your verification token."
    >
      {status === "loading" ? (
        <div className="route-loader-card">
          <div className="spinner" aria-hidden="true" />
          <p>{message}</p>
        </div>
      ) : null}

      {status === "success" ? (
        <>
          <div className="status-banner status-success">{message}</div>
          <Link to={loginPath} className="button-primary button-link-like">
            Continue to login
          </Link>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <div className="status-banner status-error">{message}</div>
          <div className="inline-actions">
            <Link to="/check-email">Request a new verification link</Link>
          </div>
        </>
      ) : null}
    </AuthLayout>
  );
}
