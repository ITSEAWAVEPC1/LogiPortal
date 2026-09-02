"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

export function PortalSignOut() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </Button>
  );
}
