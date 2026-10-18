"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, validCredentials } from "../../lib/auth.ts";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!validCredentials(email, password)) redirect("/login?error=1");
  await createSession(email.trim().toLowerCase());
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
