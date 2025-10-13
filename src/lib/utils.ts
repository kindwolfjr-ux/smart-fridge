import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SALT = process.env.ANALYTICS_UID_SALT ?? process.env.ANON_SALT ?? "";

export function anonIdFrom(raw: string) {
  if (!SALT) {
    console.warn("⚠️ ANALYTICS_UID_SALT is not set in .env.local");
  }
  return crypto
    .createHmac("sha256", SALT)
    .update(raw)
    .digest("hex")
    .slice(0, 32);
}
