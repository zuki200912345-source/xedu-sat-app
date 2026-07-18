import type { DefaultSession } from "next-auth";
import type { Role, Tier } from "@/lib/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tier: Tier;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    tier?: Tier;
    subscriptionStatus?: string;
  }
}
