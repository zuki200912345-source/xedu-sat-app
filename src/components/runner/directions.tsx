"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DirectionsDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Directions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {section === "MATH" ? (
            <>
              <p>
                The questions in this section address a number of important math skills.
                Use of a calculator is permitted for all questions.
              </p>
              <p>
                For multiple-choice questions, solve each problem and choose the correct
                answer from the choices provided. For student-produced response questions,
                solve each problem and enter your answer as described below.
              </p>
              <p>
                Unless otherwise indicated, all variables and expressions represent real
                numbers, figures are drawn to scale, and the domain of a function is the set
                of all real numbers for which the function is defined.
              </p>
            </>
          ) : (
            <>
              <p>
                The questions in this section address a number of important reading and
                writing skills. Each question includes one or more passages, which may
                include a table or graph.
              </p>
              <p>
                Read each passage and question carefully, and then choose the best answer to
                the question based on the passage. All questions in this section are
                multiple-choice with four answer options. Each question has a single best
                answer.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
