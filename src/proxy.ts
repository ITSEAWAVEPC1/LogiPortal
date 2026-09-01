import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

// Next.js 16 renamed the "middleware.ts" file convention to "proxy.ts"
// (see node_modules/next/dist/docs/.../file-conventions/proxy.md) — this file
// was migrated from src/middleware.ts. Still built on the edge-safe authConfig
// (no Credentials/Prisma) even though proxy now defaults to the Node.js
// runtime rather than edge — the split is harmless either way and keeps this
// file minimal. The full auth() with providers lives in src/lib/auth/auth.ts.
const { auth } = NextAuth(authConfig);

// Next's proxy-file export check requires a literal function export — it
// doesn't resolve through a re-exported `const { auth } = NextAuth(...)`
// binding, even though that binding is itself a callable function at
// runtime. Wrapping it in an explicit declaration satisfies the check.
export default function proxy(...args: Parameters<typeof auth>) {
  return auth(...args);
}

export const config = {
  // Negative-lookahead keeps the auth gate OFF of: API routes, Next internals,
  // the public design-system page, and any static asset file (matched by
  // extension). Without the extension exclusion an unauthenticated request for
  // a file in public/ — e.g. the logo on /login — is redirected to /login and
  // the browser renders it as a broken image.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|design-system|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|bmp|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
