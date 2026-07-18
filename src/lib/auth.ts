import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/enums";
import { getServerSession } from "next-auth";
import { rateLimit, clientIp, LIMITS } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle credential attempts per IP+email to blunt brute force /
        // credential stuffing. Exceeding the limit fails the attempt.
        const ip = clientIp((n) => {
          const h = req?.headers as Record<string, string> | undefined;
          return h?.[n] ?? h?.[n.toLowerCase()] ?? null;
        });
        const rl = rateLimit(`login:${ip}:${email}`, LIMITS.login.limit, LIMITS.login.windowMs);
        if (!rl.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    // Email magic-link stub: swap in NextAuth's EmailProvider with a real
    // SMTP transport for prod. In dev, credentials auth is the primary path.
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in (and on session refresh) hydrate the role from the DB so
      // permission changes take effect without re-login on next refresh.
      const userId = user?.id ?? token.sub;
      if (userId && (user || trigger === "update" || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (dbUser) token.role = Role.parse(dbUser.role);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as Role) ?? "STUDENT";
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
