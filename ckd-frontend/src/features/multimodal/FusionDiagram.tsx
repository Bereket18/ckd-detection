/**
 * Fusion, drawn.
 *
 * The picture carries one claim that prose states less efficiently: the two paths
 * are not equal here. The measurement path exists — it is the deployed service. The
 * image path does not exist at all in this product. So the drawing gives the left
 * column a solid border and the right column a dashed one, and says which is which
 * in words inside the boxes, in the caption, and in the `aria-label`.
 *
 * Accessibility decisions, matching `FederationDiagram`:
 *
 * - `role="img"` with a full-sentence `aria-label`; the sections around it (two
 *   evidence cards, the strategy table) are the real text equivalent.
 * - The drawing keeps its size inside a focusable `role="region"` scroller rather
 *   than shrinking its labels below legibility at 320 px.
 * - Dashed versus solid is paired with the words "not part of this service", so the
 *   distinction survives without the stroke pattern being noticed.
 *
 * No number appears anywhere in it. There is no fusion result to report.
 */

export function FusionDiagram() {
  return (
    <figure className="space-y-2">
      <div
        role="region"
        tabIndex={0}
        aria-label="Diagram of a fusion model's structure"
        className="w-full overflow-x-auto rounded-lg border border-border bg-paper p-3"
      >
        <svg
          viewBox="0 0 640 420"
          role="img"
          aria-label="Two paths lead to one score. On the left, laboratory measurements pass through a tabular model — this is the path the deployed service uses. On the right, a kidney image would pass through an image model, drawn with a dashed outline because no such path exists in this service. Both would meet at a combining step that produces a single score. Joining them requires a scan and a blood panel from the same person at the same visit."
          className="h-auto w-full min-w-[560px]"
        >
          <defs>
            <marker
              id="fusion-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ink-subtle" />
            </marker>
          </defs>

          {/* Left: the evidence this service actually scores. */}
          <rect
            x={16}
            y={16}
            width={200}
            height={74}
            rx={8}
            className="fill-surface stroke-accent"
            strokeWidth={1.5}
          />
          <text x={116} y={40} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Laboratory values
          </text>
          <text x={116} y={58} textAnchor="middle" className="fill-ink-muted text-[12px]">
            creatinine, urea, haemoglobin
          </text>
          <text x={116} y={78} textAnchor="middle" className="fill-accent-ink text-[12px] font-medium">
            this service scores these
          </text>

          {/* Right: the evidence that has no path here. Dashed, and labelled as absent. */}
          <rect
            x={424}
            y={16}
            width={200}
            height={74}
            rx={8}
            className="fill-surface-sunken stroke-ink-subtle"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text x={524} y={40} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Kidney image
          </text>
          <text x={524} y={58} textAnchor="middle" className="fill-ink-muted text-[12px]">
            ultrasound or CT
          </text>
          <text x={524} y={78} textAnchor="middle" className="fill-ink-subtle text-[12px] font-medium">
            not part of this service
          </text>

          {/* The gate condition between the two sources. */}
          <text x={320} y={40} textAnchor="middle" className="fill-ink text-[12px] font-semibold">
            the hard requirement
          </text>
          <text x={320} y={58} textAnchor="middle" className="fill-ink-muted text-[12px]">
            same person,
          </text>
          <text x={320} y={74} textAnchor="middle" className="fill-ink-muted text-[12px]">
            same visit
          </text>
          <line
            x1={222}
            y1={86}
            x2={418}
            y2={86}
            className="stroke-border-strong"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* Each kind of evidence gets its own model. */}
          <line
            x1={116}
            y1={90}
            x2={116}
            y2={138}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fusion-arrow)"
          />
          <rect
            x={16}
            y={140}
            width={200}
            height={64}
            rx={8}
            className="fill-accent-soft stroke-accent"
            strokeWidth={1.5}
          />
          <text x={116} y={166} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Tabular model
          </text>
          <text x={116} y={186} textAnchor="middle" className="fill-ink-muted text-[12px]">
            the one deployed here
          </text>

          <line
            x1={524}
            y1={90}
            x2={524}
            y2={138}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            markerEnd="url(#fusion-arrow)"
          />
          <rect
            x={424}
            y={140}
            width={200}
            height={64}
            rx={8}
            className="fill-surface-sunken stroke-ink-subtle"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text x={524} y={166} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Image model
          </text>
          <text x={524} y={186} textAnchor="middle" className="fill-ink-subtle text-[12px]">
            no endpoint reaches one
          </text>

          {/* Both paths carry representations, never the raw record or the raw scan. */}
          <line
            x1={116}
            y1={204}
            x2={296}
            y2={248}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fusion-arrow)"
          />
          <line
            x1={524}
            y1={204}
            x2={344}
            y2={248}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            markerEnd="url(#fusion-arrow)"
          />
          <text x={20} y={236} className="fill-ink-muted text-[12px]">
            what each model concluded
          </text>
          <text x={470} y={236} className="fill-ink-muted text-[12px]">
            not the scan itself
          </text>

          {/* The combining step. */}
          <rect
            x={210}
            y={250}
            width={220}
            height={64}
            rx={8}
            className="fill-info-soft stroke-info"
            strokeWidth={1.5}
          />
          <text x={320} y={276} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Combining step
          </text>
          <text x={320} y={296} textAnchor="middle" className="fill-ink-muted text-[12px]">
            early, joint, or late fusion
          </text>

          <line
            x1={320}
            y1={314}
            x2={320}
            y2={348}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fusion-arrow)"
          />

          {/* One score out, and the caveat it would still carry. */}
          <rect
            x={150}
            y={350}
            width={340}
            height={58}
            rx={8}
            className="fill-surface stroke-border-strong"
            strokeWidth={1.5}
          />
          <text x={320} y={374} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            One score, two kinds of evidence
          </text>
          <text x={320} y={394} textAnchor="middle" className="fill-ink-muted text-[12px]">
            still a screening signal, still not a diagnosis
          </text>
        </svg>
      </div>
      <figcaption className="text-sm text-ink-subtle">
        Solid lines mark the path that exists — laboratory values through the deployed tabular
        model. The dashed column is drawn to explain the method and is not implemented anywhere in
        this product: no image is accepted, and no combined score is produced.
      </figcaption>
    </figure>
  );
}
