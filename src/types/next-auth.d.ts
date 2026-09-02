import type { Role } from "@/lib/permissions/roles";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    branchId: string | null;
    // Stage 9 — only ever set for CUSTOMER users; scopes the customer portal
    // to a single organization.
    organizationId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      branchId: string | null;
      organizationId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    branchId: string | null;
    organizationId: string | null;
  }
}
