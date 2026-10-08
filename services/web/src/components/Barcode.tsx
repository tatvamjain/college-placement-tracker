// Decorative barcode; the same drive always gets the same bars.
export function Barcode({ seed }: { seed: number }) {
  let state = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };

  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 200) {
    const w = 1 + Math.floor(next() * 4);
    bars.push({ x, w });
    x += w + 1 + Math.floor(next() * 3);
  }

  return (
    <svg className="barcode" viewBox="0 0 200 54" preserveAspectRatio="none" aria-hidden>
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={54} fill="currentColor" />
      ))}
    </svg>
  );
}
