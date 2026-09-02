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
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      const isLoggedIn = !!user;
      const isOnLogin = pathname.startsWith("/login");
      const isOnPortal = pathname === "/portal" || pathname.startsWith("/portal/");

      if (isOnLogin) {
        if (isLoggedIn) {
          const home = user.role === "CUSTOMER" ? "/portal" : "/dashboard";
          return Response.redirect(new URL(home, request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      // Stage 9 — role routing: CUSTOMER users live entirely in /portal, every
      // other role in the internal app. This is the earliest bounce; the
      // (portal) and (dashboard) layouts re-check server-side as the
      // authoritative gate.
      if (user.role === "CUSTOMER" && !isOnPortal) {
        return Response.redirect(new URL("/portal", request.nextUrl));
      }
      if (user.role !== "CUSTOMER" && isOnPortal) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.branchId = user.branchId;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as JWT;
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.branchId = t.branchId;
      session.user.organizationId = t.organizationId;
      return session;
    },
  },
  providers: [], // populated in ./auth.ts
} satisfies NextAuthConfig;
