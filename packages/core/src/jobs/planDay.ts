/**
 * Calendar planning job (spec §7.3). Pure: tasks + events → proposed blocks.
 * Runs on the stronger model because scheduling quality matters. No Firestore writes here.
 */
import { runClaudeJob, type ClaudeRun, PLANNING_MODEL } from "../claude/client.js";
import { PLAN_DAY_SYSTEM } from "../claude/prompts/planDay.js";
import type { ProposedBlock } from "../types/index.js";

export interface PlanDayInput {
  date: string; // YYYY-MM-DD (the day being planned)
  timezone: string;
  workingHours: { start: string; end: string };
  tasks: {
    id: string;
    title: string;
    priority: number;
    estimatedMinutes?: number;
    dueDate?: string;
  }[];
  events: { title: string; start: string; end: string }[];
}

function parseBlocks(raw: string): ProposedBlock[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("planDay: expected a JSON array from Claude.");
  }
  return parsed.map((item, i): ProposedBlock => {
    const o = item as Record<string, unknown>;
    if (typeof o.taskId !== "string" || typeof o.start !== "string" || typeof o.end !== "string") {
      throw new Error(`planDay: malformed block at index ${i}.`);
    }
    return {
      taskId: o.taskId,
      start: o.start,
      end: o.end,
      reason: typeof o.reason === "string" ? o.reason : "",
    };
  });
}

export function planDay(input: PlanDayInput): Promise<ClaudeRun<ProposedBlock[]>> {
  return runClaudeJob<ProposedBlock[]>({
    model: PLANNING_MODEL, // reasoning-heavy — reserve the stronger model here
    system: PLAN_DAY_SYSTEM,
    user: JSON.stringify(input),
    parse: parseBlocks,
    maxTokens: 4000,
  });
}
