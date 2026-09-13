import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TRAITS, type TraitId } from '@/lib/xpUtils';

interface TraitRadarChartProps {
  /** Level per trait, in TRAITS order. */
  levels: Record<TraitId, number>;
  xp: Record<TraitId, number>;
  /** Axis reaches this many levels out from zero in both directions —
   *  shared with the linear level bars above so the two agree on scale. */
  maxReach: number;
  size?: number;
}

const TAU = Math.PI * 2;

/**
 * One polygon, one entity ("you"), seven axes — a trait's LEVEL can be
 * negative in this app's system, so zero deliberately does not sit at the
 * chart's center: it sits at half radius, exactly like the linear level bars
 * elsewhere on this page (`50 + (level / maxReach) * 50`). A trait in the red
 * pulls its vertex inside that ring instead of vanishing off a scale that
 * assumed every value starts at zero.
 */
export function TraitRadarChart({ levels, xp, maxReach, size = 280 }: TraitRadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.34;
  const labelR = size * 0.46;
  const n = TRAITS.length;

  const angleFor = (i: number) => -Math.PI / 2 + (i * TAU) / n; // start at 12 o'clock, clockwise
  const radiusForLevel = (level: number) => {
    const pct = 0.5 + (level / maxReach) * 0.5; // matches pctForLevel in GrowthView
    return outerR * Math.max(0, Math.min(1, pct));
  };
  const pointAt = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const vertices = TRAITS.map((t, i) => {
    const angle = angleFor(i);
    const level = levels[t.id] ?? 0;
    const p = pointAt(angle, radiusForLevel(level));
    const label = pointAt(angle, labelR);
    return { trait: t, angle, level, xp: xp[t.id] ?? 0, point: p, label };
  });

  const polygonPoints = vertices.map((v) => `${v.point.x},${v.point.y}`).join(' ');
  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto block w-full max-w-[320px]"
      role="img"
      aria-label="Trait balance radar chart"
    >
      {/* Grid rings — the 0.5 ring is level zero, drawn distinctly as the baseline */}
      {gridRings.map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={outerR * f}
          fill="none"
          stroke={f === 0.5 ? 'hsl(var(--muted-foreground) / 0.35)' : 'hsl(var(--border))'}
          strokeWidth={f === 0.5 ? 1.25 : 1}
          strokeDasharray={f === 0.5 ? undefined : '2 3'}
        />
      ))}

      {/* Axis spokes */}
      {vertices.map((v, i) => {
        const edge = pointAt(v.angle, outerR);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={edge.x}
            y2={edge.y}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        );
      })}

      {/* The shape itself — one series, filled with the app's own primary token
          so it always matches whatever palette is active, never a fixed hex. */}
      <polygon
        points={polygonPoints}
        fill="hsl(var(--primary) / 0.18)"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Vertex dots, each in its trait's own color — the one place identity
          rides on color, and every one is also directly labeled below. */}
      {vertices.map((v, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <g>
              <circle
                cx={v.point.x}
                cy={v.point.y}
                r={10}
                fill="transparent"
                className="cursor-default"
              />
              <circle
                cx={v.point.x}
                cy={v.point.y}
                r={4}
                fill={v.trait.hex}
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
            </g>
          </TooltipTrigger>
          <TooltipContent side="top">
            {v.trait.emoji} {v.trait.name} · Lv {v.level} · {v.xp.toLocaleString()} XP
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Axis labels — text stays in neutral ink; the dot above already
          carries the trait's color identity. */}
      {vertices.map((v, i) => (
        <text
          key={i}
          x={v.label.x}
          y={v.label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.034}
          fill="hsl(var(--muted-foreground))"
          className="select-none"
        >
          {v.trait.emoji} {v.trait.name}
        </text>
      ))}
    </svg>
  );
}
