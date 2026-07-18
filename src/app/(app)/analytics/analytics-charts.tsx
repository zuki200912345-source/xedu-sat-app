"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  trend: { name: string; total: number; rw: number; math: number }[];
  byDifficulty: { difficulty: string; accuracy: number }[];
  mastery: { skill: string; section: string; accuracy: number; attempts: number }[];
  mistakes: { skill: string; count: number }[];
  avgPace: number;
}

function accuracyColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 60) return "bg-lime-500";
  if (pct >= 40) return "bg-amber-500";
  if (pct >= 20) return "bg-orange-500";
  return "bg-red-500";
}

export function AnalyticsCharts({ trend, byDifficulty, mastery, mistakes, avgPace }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Score trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Score trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Complete more full tests to see your score trend.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[400, 1600]} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} name="Total" />
                <Line type="monotone" dataKey="rw" stroke="hsl(var(--chart-3))" strokeWidth={1.5} name="R&W" />
                <Line type="monotone" dataKey="math" stroke="hsl(var(--chart-5))" strokeWidth={1.5} name="Math" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Accuracy by difficulty */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accuracy by difficulty</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDifficulty} margin={{ left: -10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="difficulty" fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="Accuracy %">
                {byDifficulty.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pacing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pacing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
          <div className="text-4xl font-bold">{avgPace}s</div>
          <p className="text-sm text-muted-foreground">average per question</p>
          <p className="text-xs text-muted-foreground">
            Target: ~71s (R&amp;W) / ~95s (Math). {avgPace <= 95 ? "On pace 👍" : "A little slow — keep practicing."}
          </p>
        </CardContent>
      </Card>

      {/* Skill mastery heatmap */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Skill mastery heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {mastery.map((m) => (
              <div
                key={m.skill}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                title={`${m.accuracy}% over ${m.attempts} questions`}
              >
                <span className={cn("h-3 w-3 rounded-full", accuracyColor(m.accuracy))} />
                <span className="font-medium">{m.skill}</span>
                <span className="text-muted-foreground">{m.accuracy}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mistake log */}
      {mistakes.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Mistakes by skill</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mistakes.map((m) => (
                <div key={m.skill} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 text-sm">{m.skill}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${Math.min(100, m.count * 15)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm text-muted-foreground">{m.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
