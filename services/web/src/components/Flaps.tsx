// Split-flap characters, like an airport departures board.
export function Flaps({
  text,
  width = 0,
  delay = 0,
}: {
  text: string;
  width?: number;
  delay?: number;
}) {
  const upper = text.toUpperCase();
  const shown = width > 0 && upper.length > width ? `${upper.slice(0, width - 1)}…` : upper;
  const chars = shown.padEnd(width, " ").split("");

  return (
    <span className="flaps" title={text}>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className={ch === " " ? "flap space" : "flap"}
          style={{ animationDelay: `${delay + i * 32}ms` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
