import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Edge-safe config: no providers with DB/bcrypt access here, since
// middleware runs on the Edge runtime and can't use Prisma or bcryptjs.
// The Credentials provider itself lives in ./auth.ts, which extends this.
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
