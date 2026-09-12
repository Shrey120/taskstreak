import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, X, Plus, Layers, ArrowDown, ArrowUp, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface StackItem {
  id: string;
  title: string;
  note?: string;
  createdAt: number;
  sortOrder: number;
}

/**
 * The stack lives server-side so the same login sees the same pile on every
 * device, and the ORDER is part of the data -- "Later" moving a card to the
 * back has to survive a reload, so rows carry an explicit sort_order rather
 * than being re-sorted by creation time.
 *
 * Errors are returned rather than swallowed: a failed save used to look
 * exactly like a successful one.
 */
async function load(deviceId?: string): Promise<{ items: StackItem[]; error?: string }> {
  if (!deviceId) return { items: [] };
  const { data, error } = await supabase
    .from('stack_items')
    .select('id, title, note, created_at, sort_order')
    .eq('device_id', deviceId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return { items: [], error: error.message };
  return {
    items: (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      note: r.note ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
      sortOrder: r.sort_order ?? 0,
    })),
  };
}

/** Renumber the pile with a wide gap so single moves rarely need a rewrite. */
const STEP = 1000;

async function persistOrder(rows: StackItem[]): Promise<string | undefined> {
  const updates = rows.map((r, i) =>
    supabase.from('stack_items').update({ sort_order: (i + 1) * STEP }).eq('id', r.id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  return failed?.error?.message;
}

export function StackView() {
  const { user } = useAuth();
  const [items, setItems] = useState<StackItem[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [completedToday, setCompletedToday] = useState(0);
  const [anim, setAnim] = useState<'none' | 'complete' | 'sendBack'>('none');

  const deviceId = user?.device_id || '';

  useEffect(() => {
    let cancelled = false;
    load(deviceId).then(({ items: rows, error }) => {
      if (cancelled) return;
      setItems(rows);
      if (error) toast.error(`Could not load your stack: ${error}`);
    });
    return () => { cancelled = true; };
  }, [deviceId]);

  /**
   * Applies a new pile: deletes anything that disappeared and writes the new
   * order. Both halves are reported if they fail -- a save that silently did
   * nothing was the original bug here.
   */
  const persist = async (next: StackItem[]) => {
    const previous = items;
    const goneIds = previous.filter((i) => !next.some((n) => n.id === i.id)).map((i) => i.id);
    setItems(next);

    if (goneIds.length > 0) {
      const { error } = await supabase.from('stack_items').delete().in('id', goneIds);
      if (error) {
        setItems(previous);
        toast.error(`Could not remove that: ${error.message}`);
        return;
      }
    }
    const orderErr = await persistOrder(next);
    if (orderErr) toast.error(`Order not saved: ${orderErr}`);
  };

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    if (!deviceId) {
      toast.error('Not signed in on this device yet.');
      return;
    }
    const nextOrder = items.length ? Math.min(...items.map((i) => i.sortOrder)) - STEP : STEP;
    const { data, error } = await supabase
      .from('stack_items')
      .insert({ device_id: deviceId, title: t, note: note.trim() || null, sort_order: nextOrder })
      .select('id, title, note, created_at, sort_order')
      .single();
    if (error || !data) {
      toast.error(`Could not save: ${error?.message ?? 'unknown error'}`);
      return;
    }
    setTitle('');
    setNote('');
    setItems((prev) => [
      {
        id: data.id,
        title: data.title,
        note: data.note ?? undefined,
        createdAt: new Date(data.created_at).getTime(),
        sortOrder: data.sort_order ?? nextOrder,
      },
      ...prev,
    ]);
  };

  // Pointer events rather than HTML5 drag-and-drop: the latter does not fire
  // on touch at all, and this list is used mostly on a phone.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const startDrag = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragIndex(index);
    setOverIndex(index);
  };

  const onRowPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    // Pointer capture keeps events on the handle, so find the row underneath.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest('[data-stack-index]');
    if (!row) return;
    const idx = Number(row.getAttribute('data-stack-index'));
    if (!Number.isNaN(idx)) setOverIndex(idx);
  };

  const endDrag = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      moveItem(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  /** Move an item from one index to another and persist the new order. */
  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
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
            <ul
              className="space-y-1 max-h-[280px] overflow-y-auto"
              onPointerMove={onRowPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {items.slice(1).map((it, i) => {
                const index = i + 1; // position in the full pile
                return (
                  <li
                    key={it.id}
                    data-stack-index={index}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg group touch-pan-y',
                      dragIndex === index
                        ? 'bg-primary/15 ring-1 ring-primary/40'
                        : 'hover:bg-secondary/60',
                      overIndex === index && dragIndex !== null && dragIndex !== index &&
                        'ring-1 ring-primary/30',
                    )}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(e, index)}
                      className="p-0.5 -ml-1 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                      aria-label={`Reorder ${it.title}`}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-5 text-right">
                      {index + 1}
                    </span>
                    <span className="text-sm truncate flex-1">{it.title}</span>
                    <button
                      onClick={() => moveItem(index, 1)}
                      disabled={index === 1}
                      className="p-1 text-muted-foreground/70 hover:text-foreground disabled:opacity-0"
                      aria-label={`Move ${it.title} to front of queue`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(it.id)}
                      className="p-1 text-destructive/70 transition-opacity hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                      aria-label={`Remove ${it.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
