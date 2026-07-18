import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Full-screen, chrome-free layout for the test runner (no sidebar).
export default async function RunnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
