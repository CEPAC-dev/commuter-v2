import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const JWT_ISSUER = "commuter";
const JWT_AUDIENCE = "commuter-web";
const VALID_ROLES = new Set<UserRole>(["passenger", "driver", "admin"]);

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  if (process.env.APP_ENV === "production" && secret.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  return new TextEncoder().encode(secret);
}

export type UserRole = "passenger" | "driver" | "admin";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/** Sign a JWT and set it as an httpOnly cookie. Call only from route handlers / server actions. */
export async function createSession(payload: SessionPayload): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(payload.userId) || !VALID_ROLES.has(payload.role))
    throw new Error("Invalid session payload");

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    priority: "high",
  });
}

/** Read + verify the session. Safe in server components. Returns null if absent/invalid/expired. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      !/^[a-f\d]{24}$/i.test(payload.userId) ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      !VALID_ROLES.has(payload.role as UserRole)
    )
      return null;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

/** Clear the session cookie. Call only from route handlers / server actions. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
