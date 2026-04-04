import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { resendVerification } from "../lib/api";

interface CheckInboxState {
  email?: string;
  previewUrl?: string;
}

function getSafeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export default function CheckInboxPage() {
  const location = useLocation();
  const state = (location.state as CheckInboxState | null) ?? null;

  const [email, setEmail] = useState(state?.email ?? "");
  const [previewUrl, setPreviewUrl] = useState(state?.previewUrl ?? "");
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const safePreviewUrl = getSafeHttpUrl(previewUrl);

  const loginPath = "/login";

  async function onResend(): Promise<void> {
    if (!email) {
      setStatus({
        type: "error",
        message: "Enter your email to resend a verification link.",
      });
      return;
    }

    setSending(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await resendVerification(email);
      setPreviewUrl(response.verification?.previewUrl ?? "");
      setStatus({
        type: "success",
        message: response.message,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not resend verification email",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout
      badge="Email Verification"
      title="Check your inbox"
      subtitle="We sent a verification link to your email. Verify first, then login."
      footer={
        <p>
          Already verified? <Link to={loginPath}>Go to login</Link>
        </p>
      }
    >
      <div className="status-banner status-info">
        Login is blocked until your email is verified.
      </div>

      <div className="status-banner status-info">
        If you do not receive an email, SMTP is probably not configured. In development, use the
        preview verification link shown below.
      </div>

      <div className="field">
        <label className="field-label" htmlFor="resendEmail">
          Email for resend
        </label>
        <input
          id="resendEmail"
          type="email"
          className="field-input"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <button className="button-secondary" type="button" onClick={() => void onResend()} disabled={sending}>
        {sending ? "Sending..." : "Resend verification email"}
      </button>

      {status.type === "success" ? <div className="status-banner status-success">{status.message}</div> : null}
      {status.type === "error" ? <div className="status-banner status-error">{status.message}</div> : null}

      {safePreviewUrl ? (
        <div className="status-banner status-info">
          Dev preview link: <a href={safePreviewUrl}>{safePreviewUrl}</a>
        </div>
      ) : null}
    </AuthLayout>
  );
}
