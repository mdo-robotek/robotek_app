/**
 * Sarthi mark — a chariot wheel.
 *
 * Sahil, 25 Oct 2026: the ERP is renamed "Sarthi" — like Krishna as Arjuna's
 * charioteer, it guides the team to the win. The wheel carries that idea
 * without putting a religious figure on a work tool, and stays calm enough
 * for the ERP's one-accent design rule.
 */
export default function SarthiMark({
  className = "w-8 h-8",
  title = "Sarthi",
}: {
  className?: string;
  title?: string;
}) {
  // 8 spokes from the hub (r=2.6) to the rim (r=9.2)
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return {
      x1: 12 + 2.6 * c,
      y1: 12 + 2.6 * s,
      x2: 12 + 9.2 * c,
      y2: 12 + 9.2 * s,
    };
  });

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="2.6" />
      {spokes.map((p, i) => (
        <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
      ))}
    </svg>
  );
}
