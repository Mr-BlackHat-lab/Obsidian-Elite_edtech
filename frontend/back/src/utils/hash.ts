import crypto from "node:crypto";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateSecureToken(size = 48): string {
  return crypto.randomBytes(size).toString("hex");
}
