import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'sparkle' | 'ring' | 'coin';
}

const COLORS = [
  'hsl(160 100% 50%)',   // neon green
  'hsl(280 100% 65%)',   // neon purple
  'hsl(180 100% 50%)',   // neon cyan
  'hsl(320 100% 60%)',   // neon pink
  'hsl(50 100% 55%)',    // neon yellow
];

export function useCompletionEffect() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showBanner, setShowBanner] = useState(false);
  const [earnedAmount, setEarnedAmount] = useState(0);

  const triggerCompletion = useCallback((amount: number, element?: HTMLElement) => {
    setEarnedAmount(amount);
    setShowBanner(true);

    const rect = element?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: Date.now() + i,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        type: Math.random() > 0.7 ? 'coin' : 'sparkle',
      });
    }
    setParticles(newParticles);

    setTimeout(() => setShowBanner(false), 1800);
    setTimeout(() => setParticles([]), 1200);
  }, []);

  return { triggerCompletion, particles, showBanner, earnedAmount };
}

export function CompletionEffectLayer({
  particles,
  showBanner,
  earnedAmount,
}: {
  particles: Particle[];
  showBanner: boolean;
  earnedAmount: number;
}) {
  const [animatedParticles, setAnimatedParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (particles.length === 0) {
      setAnimatedParticles([]);
      return;
    }
    setAnimatedParticles(particles);

    let frame: number;
    const animate = () => {
      setAnimatedParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            life: p.life - 0.02 / p.maxLife,
          }))
          .filter(p => p.life > 0)
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [particles]);

  return createPortal(
    <>
      {/* Particles */}
      <svg
        className="fixed inset-0 pointer-events-none z-[9999]"
        width="100%"
        height="100%"
      >
        {animatedParticles.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size * p.life}
            fill={p.color}
            opacity={p.life}
            style={{
              filter: `drop-shadow(0 0 ${p.size}px ${p.color})`,
            }}
          />
        ))}
      </svg>

      {/* Earned banner */}
      {showBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
          <div className="px-6 py-3 rounded-2xl bg-card/90 backdrop-blur-xl border border-primary/30 shadow-glow animate-slide-in">
            <span className="text-lg font-display font-bold text-primary neon-text">
              +₹{earnedAmount.toFixed(2)} earned! ✨
            </span>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
