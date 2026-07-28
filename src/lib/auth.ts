import { compare, hash } from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SessionUser } from "./types";

export const sessionCookieName = "careerpilot_session";

function secretKey() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const result = await jwtVerify(token, secretKey());
    const email = typeof result.payload.email === "string" ? result.payload.email : "";
    if (!result.payload.sub || !email) return null;
    return { id: result.payload.sub, email };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token ? verifySessionToken(token) : null;
}
