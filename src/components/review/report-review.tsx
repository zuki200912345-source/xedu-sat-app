"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionReview, type ReviewItem } from "@/components/review/question-review";

export interface SectionReview {
  section: "RW" | "MATH";
  label: string;
  modules: { title: string; items: ReviewItem[] }[];
}

export function ReportReview({ sections }: { sections: SectionReview[] }) {
  return (
    <Tabs defaultValue={sections[0]?.section} className="w-full">
      <TabsList>
        {sections.map((s) => (
          <TabsTrigger key={s.section} value={s.section}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((s) => (
        <TabsContent key={s.section} value={s.section} className="space-y-6">
          {s.modules.map((m) => (
            <div key={m.title} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {m.title}
              </h3>
              {m.items.map((item) => (
                <QuestionReview key={item.id} item={item} />
              ))}
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
