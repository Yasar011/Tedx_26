import { Task } from "./types";

export type HealthLabel = "Healthy" | "Needs Attention" | "Critical";

export function computeDepartmentHealth(tasks: Task[]): { score: number; label: HealthLabel; emoji: string } {
  if (tasks.length === 0) return { score: 100, label: "Healthy", emoji: "🟢" };

  const completed = tasks.filter((t) => t.status === "COMPLETED" || t.status === "APPROVED").length;
  const overdue = tasks.filter((t) => t.deadline && t.deadline < Date.now() && t.status !== "COMPLETED").length;
  const completionRate = completed / tasks.length;

  const score = Math.max(0, Math.min(100, Math.round(completionRate * 100 - overdue * 5)));

  const label: HealthLabel = score >= 70 ? "Healthy" : score >= 40 ? "Needs Attention" : "Critical";
  const emoji = label === "Healthy" ? "🟢" : label === "Needs Attention" ? "🟡" : "🔴";

  return { score, label, emoji };
}
