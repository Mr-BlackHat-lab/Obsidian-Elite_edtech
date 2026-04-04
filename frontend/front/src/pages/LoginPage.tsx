import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupPath = "/signup";
  const checkEmailPath = "/check-email";

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");

    try {
      await login(values);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Authentication failed. Please verify your credentials.");
    }
  });

  return (
    <AuthLayout
      badge="System Authentication"
      title="Access Your Account"
      subtitle="Authenticate with your credentials to enter the secure portal."
      footer={
        <p>
          Require access? <Link to={signupPath}>Register</Link>
        </p>
      }
    >
      {serverError ? <div className="status-banner status-error">{serverError}</div> : null}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field-input"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field-input"
            placeholder="Enter password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
        </div>

        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Authenticating..." : "Sign In"}
        </button>
      </form>

      <div className="inline-actions">
        <Link to={checkEmailPath}>Pending email verification?</Link>
      </div>
    </AuthLayout>
  );
}
