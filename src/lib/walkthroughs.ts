import scripts from "../../prisma/seed-data/walkthroughs.json";
import { RW_DOMAINS, MATH_DOMAINS } from "@/lib/enums";

export interface WalkthroughScript {
  section: string;
  domain: string;
  skill: string;
  intro: string[];
  strategy: string[];
  teachIntro: string;
  soloIntro: string;
  encouragements: string[];
  retryNudge: string;
  explainIntro: string;
}

const WALKTHROUGHS = scripts as Record<string, WalkthroughScript>;

export function getScript(skill: string): WalkthroughScript | null {
  return WALKTHROUGHS[skill] ?? null;
}

export function hasScript(skill: string): boolean {
  return skill in WALKTHROUGHS;
}

export interface SkillGroup {
  section: "RW" | "MATH";
  domain: string;
  skills: string[];
}

/** All walkthrough skills grouped by section + domain (blueprint taxonomy). */
export function walkthroughGroups(): SkillGroup[] {
  const groups: SkillGroup[] = [];
  for (const [domain, skills] of Object.entries(RW_DOMAINS)) {
    const withScript = (skills as readonly string[]).filter(hasScript);
    if (withScript.length) groups.push({ section: "RW", domain, skills: withScript });
  }
  for (const [domain, skills] of Object.entries(MATH_DOMAINS)) {
    const withScript = (skills as readonly string[]).filter(hasScript);
    if (withScript.length) groups.push({ section: "MATH", domain, skills: withScript });
  }
  return groups;
}
