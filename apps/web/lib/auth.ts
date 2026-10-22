import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "anchorpoint_session";
const localEmail = "revops@anchorpoint.example";
const localPassword = "anchorpoint-local";
const localSecret = "anchorpoint-local-session-secret-change-in-production";

function configured(name: "APP_AUTH_SECRET" | "DEMO_USER_EMAIL" | "DEMO_USER_PASSWORD"): string {
  const value = process.env[name];
  if (value) {
    if (process.env.NODE_ENV === "production") {
      if (value.startsWith("replace-with-")) {
        throw new Error(`${name} must not use the documented placeholder value.`);
      }
      if (name === "APP_AUTH_SECRET" && value.length < 32) {
        throw new Error("APP_AUTH_SECRET must contain at least 32 characters.");
      }
      if (name === "DEMO_USER_PASSWORD" && value.length < 12) {
        throw new Error("DEMO_USER_PASSWORD must contain at least 12 characters.");
      }
    }
    return value;
  }
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is required in production.`);
  if (name === "APP_AUTH_SECRET") return localSecret;
  if (name === "DEMO_USER_EMAIL") return localEmail;
  return localPassword;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function signature(payload: string): string {
  return createHmac("sha256", configured("APP_AUTH_SECRET")).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

export function validCredentials(email: string, password: string): boolean {
  return (
    safeEqual(email.trim().toLowerCase(), configured("DEMO_USER_EMAIL").trim().toLowerCase()) &&
    safeEqual(password, configured("DEMO_USER_PASSWORD"))
  );
}

export async function createSession(email: string): Promise<void> {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${Buffer.from(email).toString("base64url")}.${expiresAt}`;
  const value = `${payload}.${signature(payload)}`;
  (await cookies()).set(cookieName, value, {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(cookieName);
}

export async function sessionEmail(): Promise<string | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const [encodedEmail, expiresRaw, receivedSignature, ...extra] = value.split(".");
  if (!encodedEmail || !expiresRaw || !receivedSignature || extra.length > 0) return null;
  const payload = `${encodedEmail}.${expiresRaw}`;
  if (!safeEqual(receivedSignature, signature(payload))) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  try {
    return Buffer.from(encodedEmail, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

// AUTH_DISABLED=true opens the dashboard without sign-in. The board shows only the
// synthetic inspection-v1 fixture, and the API token stays on the server.
export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}

export async function requireSession(): Promise<string> {
  if (authDisabled()) return "public demo";
  const email = await sessionEmail();
  if (!email) redirect("/login");
  return email;
}
