import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Edge-safe: uses authConfig only (no Credentials/Prisma), just to read the
// JWT and gate routes. The full auth() with providers lives in src/lib/auth/auth.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|design-system).*)"],
};
