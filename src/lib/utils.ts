import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SALT = process.env.ANON_SALT!;

export function anonIdFrom(raw: string) {
  if (!SALT) {
    console.warn("⚠️ ANON_SALT is not set. Set it in .env.local");
  }
  return crypto.createHash("sha256").update(`${raw}|${SALT}`).digest("hex");
}
