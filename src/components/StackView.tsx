import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, X, Plus, Layers, ArrowDown, Trash2 } from 'lucide-react';

interface StackItem {
  id: string;
  title: string;
  note?: string;
  createdAt: number;
}

function storageKey(userId?: string) {
  return `taskstreak:stack:${userId ?? 'anon'}`;
}

function load(userId?: string): StackItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as StackItem[];
  } catch {
    return [];
  }
}

function save(userId: string | undefined, items: StackItem[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(items));
}

export function StackView() {
  const { user } = useAuth();
  const [items, setItems] = useState<StackItem[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [completedToday, setCompletedToday] = useState(0);
  const [anim, setAnim] = useState<'none' | 'complete' | 'sendBack'>('none');

  useEffect(() => {
    setItems(load(user?.id));
  }, [user?.id]);

  const persist = (next: StackItem[]) => {
    setItems(next);
    save(user?.id, next);
  };

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const item: StackItem = {
      id: crypto.randomUUID(),
      title: t,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    };
    persist([item, ...items]);
    setTitle('');
    setNote('');
  };

  const top = items[0];

  const complete = () => {
    if (!top) return;
    setAnim('complete');
    setCompletedToday((n) => n + 1);
    setTimeout(() => {
      persist(items.slice(1));
      setAnim('none');
    }, 260);
  };

  const sendBack = () => {
    if (!top || items.length < 2) return;
    setAnim('sendBack');
    setTimeout(() => {
      persist([...items.slice(1), top]);
      setAnim('none');
    }, 260);
  };

  const remove = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  const stackDepth = Math.min(items.length, 4);
  const behind = useMemo(() => items.slice(1, 4), [items]);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      {/* LEFT: Stack */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              To-do Stack
            </h2>
            <p className="text-xs text-muted-foreground">
              Pop one task off the top at a time. No pressure, no clutter.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">In stack</div>
            <div className="text-2xl font-display font-bold text-primary tabular-nums">{items.length}</div>
          </div>
        </div>

        {/* Card stack */}
        <div className="relative h-[340px] flex items-center justify-center">
          {items.length === 0 ? (
            <div className="text-center px-6 py-10 rounded-2xl border border-dashed border-border/60 bg-card/40 backdrop-blur-sm">
              <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-base font-semibold">Stack is empty</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add something on the right to start the pile.
              </p>
            </div>
          ) : (
            <>
              {/* Behind cards */}
              {behind.map((it, i) => {
                const depth = i + 1;
                return (
                  <div
                    key={it.id}
                    className="absolute inset-x-6 rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm shadow-lg"
                    style={{
                      top: 12 + depth * 10,
                      bottom: 12 - depth * 4,
                      transform: `scale(${1 - depth * 0.04})`,
                      opacity: 1 - depth * 0.22,
                      zIndex: 10 - depth,
                    }}
                  />
                );
              })}
              {/* Top card */}
              <div
                key={top!.id}
                className={cn(
                  'absolute inset-x-0 top-0 bottom-0 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-card via-card/95 to-primary/10 backdrop-blur-md p-6 flex flex-col shadow-glow transition-all duration-300',
                  anim === 'complete' && 'translate-y-[-40px] opacity-0 rotate-[-6deg]',
                  anim === 'sendBack' && 'translate-y-[40px] opacity-0 scale-90',
                )}
                style={{ zIndex: 20 }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Next up
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {stackDepth} card{stackDepth !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-2xl font-display font-bold text-foreground leading-tight break-words">
                    {top!.title}
                  </h3>
                  {top!.note && (
                    <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {top!.note}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    onClick={sendBack}
                    variant="secondary"
                    className="flex-1"
                    disabled={items.length < 2}
                  >
                    <ArrowDown className="w-4 h-4 mr-1" />
                    Later
                  </Button>
                  <Button
                    onClick={() => remove(top!.id)}
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    aria-label="Discard"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={complete}
                    className="flex-1 bg-success/20 border border-success/50 text-success hover:bg-success/30"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {completedToday > 0 && (
          <div className="text-center text-xs text-success font-semibold">
            ✓ {completedToday} cleared this session
          </div>
        )}
      </div>

      {/* RIGHT: Add + list */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Push to stack
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to do?"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />
          <Button onClick={add} className="w-full" disabled={!title.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Add to top
          </Button>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1 pb-2">
            Coming up ({Math.max(0, items.length - 1)})
          </div>
          {items.length <= 1 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nothing queued.
            </p>
          ) : (
            <ul className="space-y-1 max-h-[280px] overflow-y-auto">
              {items.slice(1).map((it, i) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 group"
                >
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5 text-right">
                    {i + 2}
                  </span>
                  <span className="text-sm truncate flex-1">{it.title}</span>
                  <button
                    onClick={() => remove(it.id)}
                    className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive transition-opacity"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
