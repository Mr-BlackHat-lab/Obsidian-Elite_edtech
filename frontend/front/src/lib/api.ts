export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  refreshExpiresAt: string;
}

interface ApiEnvelope<T> {
  message: string;
  data: T;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const rawBody = await response.text();
  let payload: { message?: string; data?: T; details?: unknown } | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as { message?: string; data?: T; details?: unknown };
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.details,
    );
  }

  return {
    message: payload?.message ?? "Success",
    data: payload?.data as T,
  };
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<{
  user: AuthUser;
  verification: { sent: true; expiresAt: string; previewUrl?: string };
}> {
  const result = await request<{ user: AuthUser; verification: { sent: true; expiresAt: string; previewUrl?: string } }>(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return result.data;
}

export async function login(payload: LoginPayload): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const result = await request<{ user: AuthUser; tokens: AuthTokens }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result.data;
}

export async function verifyEmail(token: string): Promise<{ user: AuthUser }> {
  const result = await request<{ user: AuthUser }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  return result.data;
}

export async function resendVerification(email: string): Promise<{
  message: string;
  verification?: { expiresAt: string; previewUrl?: string };
}> {
  const result = await request<{
    message: string;
    verification?: { expiresAt: string; previewUrl?: string };
  }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  return result.data;
}

export async function refreshToken(refreshTokenValue: string): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const result = await request<{ user: AuthUser; tokens: AuthTokens }>("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });

  return result.data;
}

export async function logout(refreshTokenValue: string): Promise<{ revoked: boolean }> {
  const result = await request<{ revoked: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });

  return result.data;
}

export async function getMe(accessToken: string): Promise<{ user: AuthUser }> {
  const result = await request<{ user: AuthUser }>("/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return result.data;
}

export interface PerformanceRecord {
  id: string;
  userId: string;
  score: number;
  correct: number;
  incorrect: number;
  recordedAt: string;
}

export interface PerformanceData {
  history: PerformanceRecord[];
  currentScore: number;
}

export async function getPerformanceInfo(accessToken: string): Promise<PerformanceData> {
  const result = await request<PerformanceData>("/performance", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return result.data;
}

export async function addPerformanceResult(accessToken: string, isCorrect: boolean): Promise<PerformanceData> {
  const result = await request<PerformanceData>("/performance", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ isCorrect }),
  });
  return result.data;
}
