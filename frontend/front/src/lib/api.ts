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

interface BackendAuthResponse {
  user_id: string;
  username: string;
  token: string;
}

interface BackendUser {
  user_id: string;
  username: string;
  email?: string;
  created_at?: string;
}

interface BackendPerformance {
  user_id: string;
  overall_accuracy: number;
  sessions?: Array<{
    session_id: string;
    score: number;
    created_at?: string;
  }>;
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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function toAuthUser(user: BackendUser): AuthUser {
  return {
    id: user.user_id,
    name: user.username,
    email: user.email ?? "",
    isVerified: true,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

function buildCompatTokens(accessToken: string): AuthTokens {
  const refreshToken = `${accessToken}.refresh`;
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: "3600",
    refreshExpiresAt: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1] ?? "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
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
      payload = JSON.parse(rawBody) as {
        message?: string;
        data?: T;
        details?: unknown;
      };
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
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<{
  user: AuthUser;
  verification: { sent: true; expiresAt: string; previewUrl?: string };
}> {
  const normalizedUsername =
    payload.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || `user_${Math.random().toString(36).slice(2, 8)}`;

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: normalizedUsername,
      email: payload.email,
      password: payload.password,
    }),
  });

  const raw = (await response.json()) as
    | BackendAuthResponse
    | { detail?: string };
  if (!response.ok) {
    throw new ApiError(
      (raw as { detail?: string }).detail ?? "Registration failed",
      response.status,
      raw,
    );
  }

  const auth = raw as BackendAuthResponse;

  return {
    user: {
      id: auth.user_id,
      name: auth.username,
      email: payload.email,
      isVerified: true,
      createdAt: new Date().toISOString(),
    },
    verification: {
      sent: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function login(
  payload: LoginPayload,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
    }),
  });

  const raw = (await response.json()) as
    | BackendAuthResponse
    | { detail?: string };
  if (!response.ok) {
    throw new ApiError(
      (raw as { detail?: string }).detail ?? "Authentication failed",
      response.status,
      raw,
    );
  }

  const auth = raw as BackendAuthResponse;

  return {
    user: {
      id: auth.user_id,
      name: auth.username,
      email: "",
      isVerified: true,
      createdAt: new Date().toISOString(),
    },
    tokens: buildCompatTokens(auth.token),
  };
}

export async function verifyEmail(token: string): Promise<{ user: AuthUser }> {
  void token;
  return {
    user: {
      id: "verified-user",
      name: "verified",
      email: "",
      isVerified: true,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function resendVerification(email: string): Promise<{
  message: string;
  verification?: { expiresAt: string; previewUrl?: string };
}> {
  return {
    message: `Verification is not required in this backend mode for ${email}.`,
    verification: {
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function refreshToken(refreshTokenValue: string): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const accessToken = refreshTokenValue.replace(/\.refresh$/, "");
  const me = await getMe(accessToken);
  return {
    user: me.user,
    tokens: buildCompatTokens(accessToken),
  };
}

export async function logout(
  refreshTokenValue: string,
): Promise<{ revoked: boolean }> {
  void refreshTokenValue;
  return { revoked: true };
}

export async function getMe(accessToken: string): Promise<{ user: AuthUser }> {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const raw = (await response.json()) as BackendUser | { detail?: string };
  if (!response.ok) {
    throw new ApiError(
      (raw as { detail?: string }).detail ?? "Could not fetch user",
      response.status,
      raw,
    );
  }

  return { user: toAuthUser(raw as BackendUser) };
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

export async function getPerformanceInfo(
  accessToken: string,
): Promise<PerformanceData> {
  const jwtPayload = decodeJwtPayload(accessToken);
  const tokenUserId =
    typeof jwtPayload.user_id === "string" ? jwtPayload.user_id : "";

  let userId = tokenUserId;
  if (!userId) {
    const me = await getMe(accessToken);
    userId = me.user.id;
  }

  const response = await fetch(
    `${API_BASE_URL}/performance/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const raw = (await response.json()) as
    | BackendPerformance
    | { detail?: string };
  if (!response.ok) {
    throw new ApiError(
      (raw as { detail?: string }).detail ?? "Could not fetch performance",
      response.status,
      raw,
    );
  }

  const perf = raw as BackendPerformance;
  return {
    currentScore: Math.round((perf.overall_accuracy ?? 0) * 100),
    history: (perf.sessions ?? []).map((session) => ({
      id: session.session_id,
      userId,
      score: Math.round((session.score ?? 0) * 100),
      correct: 0,
      incorrect: 0,
      recordedAt: session.created_at || new Date().toISOString(),
    })),
  };
}

export async function addPerformanceResult(
  accessToken: string,
  isCorrect: boolean,
): Promise<PerformanceData> {
  void isCorrect;
  return getPerformanceInfo(accessToken);
}
