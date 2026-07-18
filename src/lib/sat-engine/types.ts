import type { Section, Format } from "./spec";

/** Normalized question as the engine consumes it (framework/DB-agnostic). */
export interface BankItem {
  id: string;
  section: Section;
  /** Spec block type (R&W) or spec math domain key (Math). */
  type: string;
  /** SEC subtype (R&W) or math subtopic (Math); null when not applicable. */
  subtype: string | null;
  /** Spec domain name. */
  domain: string;
  /** Continuous difficulty 1.0–3.0. */
  difficulty: number;
  format: Format;
}

/** A generated module: an ordered list of chosen item ids + metadata. */
export interface GeneratedModule {
  section: Section;
  tier: number;
  seed: string;
  itemIds: string[];
  items: BankItem[];
}
