import type { Metadata } from "next";
import { DiagnosticRunner } from "./diagnostic-runner";

export const metadata: Metadata = { title: "Diagnostic in progress" };

export default function DiagnosticQuizPage() {
  return <DiagnosticRunner />;
}
