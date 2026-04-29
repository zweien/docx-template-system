import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const nextAuthHandler = NextAuth(authOptions);

export async function GET(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const url = new URL(req.url);
  const dynamicBaseUrl = `${url.protocol}//${url.host}`;

  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = dynamicBaseUrl;

  try {
    return await nextAuthHandler(req, context);
  } finally {
    if (original !== undefined) {
      process.env.NEXTAUTH_URL = original;
    } else {
      delete process.env.NEXTAUTH_URL;
    }
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const url = new URL(req.url);
  const dynamicBaseUrl = `${url.protocol}//${url.host}`;

  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = dynamicBaseUrl;

  try {
    return await nextAuthHandler(req, context);
  } finally {
    if (original !== undefined) {
      process.env.NEXTAUTH_URL = original;
    } else {
      delete process.env.NEXTAUTH_URL;
    }
  }
}
