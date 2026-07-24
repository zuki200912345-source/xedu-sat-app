import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { hasCompletedDiagnostic } from "@/lib/training";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const diagnosticDone = await hasCompletedDiagnostic(session.user.id);
  return <AppShell role={session.user.role} hideDiagnostic={diagnosticDone}>{children}</AppShell>;
}
