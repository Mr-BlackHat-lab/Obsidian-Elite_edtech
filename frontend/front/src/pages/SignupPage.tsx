import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Add at least one uppercase letter")
      .regex(/[a-z]/, "Add at least one lowercase letter")
      .regex(/[0-9]/, "Add at least one number")
      .regex(/[^A-Za-z0-9]/, "Add at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loginPath = "/login";

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");

    try {
      const result = await signup({
        name: values.name,
        email: values.email,
        password: values.password,
      });

      navigate("/check-email", {
        replace: true,
        state: {
          email: values.email,
          previewUrl: result.verification.previewUrl,
        },
      });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Registration failed. Please attempt again.");
    }
  });

  return (
    <AuthLayout
      badge="System Registration"
      title="Initialize Account"
      subtitle="Provision your system credentials to access the central secure dashboard."
      footer={
        <p>
          Already possess credentials? <Link to={loginPath}>Sign In</Link>
        </p>
      }
    >
      {serverError ? <div className="status-banner status-error">{serverError}</div> : null}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            className="field-input"
            placeholder="Your full name"
            autoComplete="name"
            {...register("name")}
          />
          {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
        </div>

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
            placeholder="Create a strong password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="field-input"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="field-error">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Provisioning..." : "Register"}
        </button>
      </form>
    </AuthLayout>
  );
}
