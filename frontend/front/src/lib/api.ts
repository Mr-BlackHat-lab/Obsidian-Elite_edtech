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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface BackendUserResponse {
  user_id?: string;
  username?: string;
  email?: string;
  created_at?: string;
  message?: string;
  error?: string;
}

interface BackendPerformanceSession {
  session_id?: string;
  score?: number;
}

interface BackendPerformanceResponse {
  user_id?: string;
  overall_accuracy?: number;
  total_questions?: number;
  sessions?: BackendPerformanceSession[];
}

function extractUserIdFromToken(token: string): string | null {
  for (const prefix of ["access:", "refresh:"]) {
    if (token.startsWith(prefix)) {
      const userId = token.slice(prefix.length);
      return userId ? userId : null;
    }
  }
  return null;
}

function buildTokens(userId: string): AuthTokens {
  const now = new Date();
  const refreshExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return {
    accessToken: `access:${userId}`,
    refreshToken: `refresh:${userId}`,
    tokenType: "Bearer",
    expiresIn: "3600",
    refreshExpiresAt,
  };
}

function mapBackendUser(user: BackendUserResponse): AuthUser {
  return {
    id: user.user_id ?? "",
    name: user.username ?? "Learner",
    email: user.email ?? "",
    isVerified: true,
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const rawBody = await response.text();
  let payload: Record<string, unknown> | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload?.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`;
    throw new ApiError(
      errorMessage,
      response.status,
      payload?.details ?? payload?.detail ?? payload,
    );
  }

  if (payload && "data" in payload) {
    return {
      message: (payload.message as string | undefined) ?? "Success",
      data: payload.data as T,
    };
  }

  return {
    message: (payload?.message as string | undefined) ?? "Success",
    data: payload as T,
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
  const result = await request<BackendUserResponse>(
    "/register",
    {
      method: "POST",
      body: JSON.stringify({
        username: payload.name,
        email: payload.email,
      }),
    },
  );

  return {
    user: mapBackendUser(result.data),
    verification: {
      sent: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function login(payload: LoginPayload): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  // Backend auth currently accepts username/email registration, so we derive
  // a stable username candidate from email for sign-in compatibility.
  const username = payload.email.includes("@") ? payload.email.split("@")[0] : payload.email;
  const result = await request<BackendUserResponse>("/register", {
    method: "POST",
    body: JSON.stringify({ username, email: payload.email }),
  });

  const user = mapBackendUser(result.data);
  return { user, tokens: buildTokens(user.id) };
}

export async function verifyEmail(token: string): Promise<{ user: AuthUser }> {
  return {
    user: {
      id: token || "local-user",
      name: "Learner",
      email: "",
      isVerified: true,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function resendVerification(_email: string): Promise<{
  message: string;
  verification?: { expiresAt: string; previewUrl?: string };
}> {
  return {
    message: "Verification flow is not enabled on the backend. You can proceed to login in local mode.",
    verification: {
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function refreshToken(refreshTokenValue: string): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const userId = extractUserIdFromToken(refreshTokenValue);
  if (!userId) {
    throw new ApiError("Invalid refresh token format", 401);
  }

  const result = await request<BackendUserResponse>(`/user/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
  if (result.data.error) {
    throw new ApiError(result.data.error, 404, result.data);
  }

  const user = mapBackendUser(result.data);
  return { user, tokens: buildTokens(user.id) };
}

export async function logout(_refreshTokenValue: string): Promise<{ revoked: boolean }> {
  return { revoked: true };
}

export async function getMe(accessToken: string): Promise<{ user: AuthUser }> {
  const userId = extractUserIdFromToken(accessToken);
  if (!userId) {
    throw new ApiError("Invalid access token format", 401);
  }

  const result = await request<BackendUserResponse>(`/user/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
  if (result.data.error) {
    throw new ApiError(result.data.error, 404, result.data);
  }

  return { user: mapBackendUser(result.data) };
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

const SCORE_INCORRECT_DELTA = -5;
const SCORE_CORRECT_DELTA = 10;

export async function getPerformanceInfo(accessToken: string): Promise<PerformanceData> {
  const userId = extractUserIdFromToken(accessToken) ?? accessToken;
  const result = await request<BackendPerformanceResponse>(`/performance/${encodeURIComponent(userId)}`, {
    method: "GET",
  });

  const history = (result.data.sessions ?? []).map((session, index) => ({
    id: session.session_id ?? `session-${index}`,
    userId: result.data.user_id ?? userId,
    score: Math.round((session.score ?? 0) * 100),
    correct: 0,
    incorrect: 0,
    recordedAt: new Date().toISOString(),
  }));

  return {
    history,
    currentScore: history.length ? (history[history.length - 1]?.score ?? 0) : 0,
  };
}

export async function addPerformanceResult(accessToken: string, isCorrect: boolean): Promise<PerformanceData> {
  const base = await getPerformanceInfo(accessToken);
  const latest = base.history.length ? base.history[base.history.length - 1] : undefined;
  const currentScore = Math.max(
    0,
    base.currentScore + (isCorrect ? SCORE_CORRECT_DELTA : SCORE_INCORRECT_DELTA),
  );
  const nextRecord: PerformanceRecord = {
    id: `local-${Date.now()}`,
    userId: latest?.userId ?? (extractUserIdFromToken(accessToken) ?? "anonymous"),
    score: currentScore,
    correct: (latest?.correct ?? 0) + (isCorrect ? 1 : 0),
    incorrect: (latest?.incorrect ?? 0) + (isCorrect ? 0 : 1),
    recordedAt: new Date().toISOString(),
  };

  return {
    history: [...base.history, nextRecord],
    currentScore,
  };
}
