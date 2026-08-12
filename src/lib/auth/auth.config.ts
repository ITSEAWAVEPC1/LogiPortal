import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Minimal, provider-free config kept separate from ./auth.ts so src/proxy.ts
// (Next.js 16's renamed middleware.ts) never pulls in the Credentials
// provider's Prisma/bcrypt dependency — proxy now defaults to the Node.js
// runtime rather than edge, but the split still keeps the request-gating
// file as small as possible. The Credentials provider itself lives in
// ./auth.ts, which extends this.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.branchId = user.branchId;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as JWT;
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.branchId = t.branchId;
      return session;
    },
  },
  providers: [], // populated in ./auth.ts
} satisfies NextAuthConfig;
