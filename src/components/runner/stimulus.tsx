"use client";

interface GraphSpec {
  type: "table";
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Renders an R&W passage plus any quantitative stimulus (data table). */
export function Stimulus({
  content,
  graphSpec,
}: {
  content: string;
  graphSpec: unknown | null;
}) {
  const spec = graphSpec as GraphSpec | null;
  return (
    <div className="space-y-4">
      {spec?.type === "table" && (
        <figure className="rounded-lg border bg-card p-3">
          <figcaption className="mb-2 text-sm font-medium">{spec.title}</figcaption>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {spec.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-border px-2 py-1.5 text-left font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-border/60 px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
      {content && (
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {content}
        </div>
      )}
    </div>
  );
}
