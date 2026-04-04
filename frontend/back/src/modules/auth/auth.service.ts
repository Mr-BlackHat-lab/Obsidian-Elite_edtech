import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { emailService } from "../../services/email.service";
import { generateSecureToken, sha256 } from "../../utils/hash";
import { HttpError } from "../../utils/httpError";
import type {
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  ResendVerificationInput,
  SignupInput,
  VerifyEmailInput,
} from "./auth.validators";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  createdAt: Date;
}

type AuthUserEntity = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  createdAt: Date;
};

function toPublicUser(user: AuthUserEntity): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

function createAccessToken(user: Pick<AuthUserEntity, "id" | "email">): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { email: user.email },
    env.JWT_ACCESS_SECRET,
    options,
  );
}

async function issueSessionTokens(user: AuthUserEntity): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  refreshExpiresAt: string;
}> {
  const refreshToken = generateSecureToken();
  const refreshTokenHash = sha256(refreshToken);
  const refreshExpiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash: refreshTokenHash,
      userId: user.id,
      expiresAt: refreshExpiresAt,
    },
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: env.JWT_ACCESS_TTL,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

async function createAndSendVerificationToken(user: AuthUserEntity): Promise<{ expiresAt: string; previewUrl?: string }> {
  await prisma.verificationToken.deleteMany({
    where: {
      userId: user.id,
    },
  });

  const rawToken = generateSecureToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + env.VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const verificationUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(rawToken)}`;

  await emailService.sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl,
  });

  return {
    expiresAt: expiresAt.toISOString(),
    ...(env.NODE_ENV !== "production" ? { previewUrl: verificationUrl } : {}),
  };
}

class AuthService {
  async signup(input: SignupInput): Promise<{
    user: PublicUser;
    verification: { sent: true; expiresAt: string; previewUrl?: string };
  }> {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (existingUser) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    const createdUser = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        isVerified: false,
      },
    });

    const verification = await createAndSendVerificationToken(createdUser);

    return {
      user: toPublicUser(createdUser),
      verification: {
        sent: true,
        expiresAt: verification.expiresAt,
        previewUrl: verification.previewUrl,
      },
    };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ user: PublicUser }> {
    const tokenHash = sha256(input.token);

    const tokenRecord = await prisma.verificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      throw new HttpError(400, "Invalid verification token");
    }

    if (tokenRecord.usedAt) {
      throw new HttpError(400, "Verification token has already been used");
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
      throw new HttpError(400, "Verification token has expired");
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: tokenRecord.userId,
      },
      data: {
        isVerified: true,
      },
    });

    await prisma.verificationToken.deleteMany({
      where: {
        userId: tokenRecord.userId,
      },
    });

    return {
      user: toPublicUser(updatedUser),
    };
  }

  async resendVerification(input: ResendVerificationInput): Promise<{
    message: string;
    verification?: { expiresAt: string; previewUrl?: string };
  }> {
    const user = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (!user || user.isVerified) {
      return {
        message:
          "If an unverified account exists for this email, a verification link has been sent",
      };
    }

    const verification = await createAndSendVerificationToken(user);

    return {
      message: "Verification email sent",
      verification,
    };
  }

  async login(input: LoginInput): Promise<{
    user: PublicUser;
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenType: "Bearer";
      expiresIn: string;
      refreshExpiresAt: string;
    };
  }> {
    const user = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Invalid email or password");
    }

    if (!user.isVerified) {
      throw new HttpError(403, "Email is not verified. Please verify your account first.");
    }

    const tokens = await issueSessionTokens(user);

    return {
      user: toPublicUser(user),
      tokens,
    };
  }

  async refreshToken(input: RefreshTokenInput): Promise<{
    user: PublicUser;
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenType: "Bearer";
      expiresIn: string;
      refreshExpiresAt: string;
    };
  }> {
    const tokenHash = sha256(input.refreshToken);

    const existing = await prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!existing || existing.revokedAt) {
      throw new HttpError(401, "Invalid refresh token");
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      await prisma.refreshToken.update({
        where: {
          id: existing.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      throw new HttpError(401, "Refresh token has expired");
    }

    if (!existing.user.isVerified) {
      throw new HttpError(403, "Email is not verified");
    }

    await prisma.refreshToken.update({
      where: {
        id: existing.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const tokens = await issueSessionTokens(existing.user);

    return {
      user: toPublicUser(existing.user),
      tokens,
    };
  }

  async logout(input: LogoutInput): Promise<{ revoked: boolean }> {
    const tokenHash = sha256(input.refreshToken);

    const result = await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      revoked: result.count > 0,
    };
  }

  async getUserById(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return toPublicUser(user);
  }
}

export const authService = new AuthService();
