/**
 * The federated round, drawn.
 *
 * A picture earns its place here because the whole idea is spatial: three hospitals,
 * one coordinating server, and a claim about *what crosses the gap between them*. A
 * paragraph can state that claim; a diagram lets a reader check it.
 *
 * Accessibility decisions:
 *
 * - The figure is `role="img"` with a one-sentence `aria-label`, and the page follows
 *   it with the same round written out as numbered steps. The steps are the real
 *   equivalent — a diagram summarised in twelve words is not one.
 * - The drawing sits in a focusable scroll region, the same pattern `DataTable` uses.
 *   Shrinking a diagram to 320 px makes its labels illegible, so it keeps its size
 *   and the region scrolls, which is reachable by keyboard.
 * - Every stroke is paired with a word. Colour distinguishes the two directions of
 *   travel; the labels say which is which, so colour is never the only signal.
 *
 * Nothing here is a number. The sites carry no record counts and the server reports
 * no accuracy, because this page has no backend source and an invented figure on a
 * page about trust would be the worst kind of decoration.
 */

const SITES = [
  { id: 'A', label: 'Site A', kind: 'Teaching hospital', cx: 128 },
  { id: 'B', label: 'Site B', kind: 'Regional hospital', cx: 320 },
  { id: 'C', label: 'Site C', kind: 'District clinic', cx: 512 },
] as const;

export function FederationDiagram() {
  return (
    <figure className="space-y-2">
      <div
        role="region"
        tabIndex={0}
        aria-label="Diagram of one federated training round"
        className="w-full overflow-x-auto rounded-lg border border-border bg-paper p-3"
      >
        <svg
          viewBox="0 0 640 430"
          role="img"
          aria-label="Three hospital sites each train on their own records and send only model updates to a coordinating server, which averages them into a shared model and sends it back to every site. Patient records never leave a site."
          className="h-auto w-full min-w-[560px]"
        >
          <defs>
            <marker
              id="fed-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ink-subtle" />
            </marker>
            <marker
              id="fed-arrow-return"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-info" />
            </marker>
          </defs>

          {/* The three participating sites. Records live inside these boxes and stay there. */}
          {SITES.map((site) => (
            <g key={site.id}>
              <rect
                x={site.cx - 88}
                y={44}
                width={176}
                height={88}
                rx={8}
                className="fill-surface stroke-accent"
                strokeWidth={1.5}
              />
              <text
                x={site.cx}
                y={68}
                textAnchor="middle"
                className="fill-ink text-[14px] font-semibold"
              >
                {site.label}
              </text>
              <text x={site.cx} y={88} textAnchor="middle" className="fill-ink-muted text-[12px]">
                {site.kind}
              </text>
              <text
                x={site.cx}
                y={112}
                textAnchor="middle"
                className="fill-accent-ink text-[12px] font-medium"
              >
                records stay here
              </text>
            </g>
          ))}

          {/* Updates travelling in: numbers, not records. */}
          <line
            x1={128}
            y1={132}
            x2={300}
            y2={206}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fed-arrow)"
          />
          <line
            x1={320}
            y1={132}
            x2={320}
            y2={206}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fed-arrow)"
          />
          <line
            x1={512}
            y1={132}
            x2={340}
            y2={206}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd="url(#fed-arrow)"
          />
          <text x={446} y={172} className="fill-ink text-[12px] font-semibold">
            what travels: numbers
          </text>
          <text x={446} y={190} className="fill-ink-muted text-[12px]">
            no rows, no names
          </text>

          {/* The coordinating server. It sees updates and never sees a record. */}
          <rect
            x={210}
            y={208}
            width={220}
            height={84}
            rx={8}
            className="fill-accent-soft stroke-accent"
            strokeWidth={1.5}
          />
          <text x={320} y={236} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Coordinating server
          </text>
          <text x={320} y={258} textAnchor="middle" className="fill-ink-muted text-[12px]">
            averages the updates it receives
          </text>
          <text x={320} y={278} textAnchor="middle" className="fill-ink-muted text-[12px]">
            holds no patient records
          </text>

          <line
            x1={320}
            y1={292}
            x2={320}
            y2={326}
            className="stroke-info"
            strokeWidth={1.5}
            markerEnd="url(#fed-arrow-return)"
          />

          {/* The shared model, and its route back to every site. */}
          <rect
            x={210}
            y={328}
            width={220}
            height={64}
            rx={8}
            className="fill-info-soft stroke-info"
            strokeWidth={1.5}
          />
          <text x={320} y={354} textAnchor="middle" className="fill-ink text-[14px] font-semibold">
            Improved shared model
          </text>
          <text x={320} y={374} textAnchor="middle" className="fill-ink-muted text-[12px]">
            one model, built from all three
          </text>

          {/*
            The return leg is drawn as a bus rather than a single arrow: out of the
            shared model, up the left margin, across the top, and then down into all
            three sites. One arrow into Site A under a label reading "every site" is
            the sort of small dishonesty a reader is right to distrust.
          */}
          <path
            d="M 210 360 H 16 V 14 H 624"
            fill="none"
            className="stroke-info"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          {SITES.map((site) => (
            <line
              key={`return-${site.id}`}
              x1={site.cx}
              y1={14}
              x2={site.cx}
              y2={44}
              className="stroke-info"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              markerEnd="url(#fed-arrow-return)"
            />
          ))}
          <text x={444} y={356} className="fill-info text-[12px] font-semibold">
            returned to every site
          </text>
          <text x={444} y={374} className="fill-ink-muted text-[12px]">
            then the round repeats
          </text>
        </svg>
      </div>
      <figcaption className="text-sm text-ink-subtle">
        One round. Records stay inside each site; only model updates cross the gap, and the
        result of averaging them comes back to everyone. The steps below say the same thing in
        words.
      </figcaption>
    </figure>
  );
}
