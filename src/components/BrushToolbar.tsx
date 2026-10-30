import { activeBrush, plannerState, toggleWeekStart } from '../store/plannerStore';
import type { BrushMode } from '../types/planner';

const BRUSHES: Array<{
  id: BrushMode;
  label: string;
  shortcut: string;
  desc: string;
  badgeClass: string;
  activeClass: string;
}> = [
  {
    id: 'confirmed',
    label: 'Confirmed Off',
    shortcut: 'C',
    desc: '1.0 PTO day (Confirmed vacation)',
    badgeClass: 'bg-emerald-500',
    activeClass:
      'border-emerald-500 bg-emerald-500/20 text-emerald-200 shadow-sm shadow-emerald-500/20',
  },
  {
    id: 'draft',
    label: 'Draft / Idea',
    shortcut: 'D',
    desc: '1.0 PTO day (Draft scenario)',
    badgeClass: 'bg-amber-400',
    activeClass:
      'border-amber-400 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/20',
  },
  {
    id: 'half-confirmed',
    label: 'Half-Day (0.5)',
    shortcut: 'H',
    desc: '0.5 Confirmed PTO day',
    badgeClass: 'bg-teal-400',
    activeClass:
      'border-teal-400 bg-teal-500/20 text-teal-200 shadow-sm shadow-teal-500/20',
  },
  {
    id: 'half-draft',
    label: 'Half-Draft (0.5)',
    shortcut: 'G',
    desc: '0.5 Draft PTO day',
    badgeClass: 'bg-yellow-400',
    activeClass:
      'border-yellow-400 bg-yellow-500/20 text-yellow-200 shadow-sm shadow-yellow-500/20',
  },
  {
    id: 'holiday',
    label: 'Public Holiday',
    shortcut: 'P',
    desc: 'Toggle public holiday (0 PTO cost)',
    badgeClass: 'bg-rose-500',
    activeClass:
      'border-rose-500 bg-rose-500/20 text-rose-200 shadow-sm shadow-rose-500/20',
  },
  {
    id: 'erase',
    label: 'Eraser',
    shortcut: 'E',
    desc: 'Clear planned status on clicked/dragged dates',
    badgeClass: 'bg-slate-400',
    activeClass:
      'border-slate-400 bg-slate-700/60 text-white shadow-sm',
  },
];

export function BrushToolbar() {
  const current = activeBrush.value;
  const weekStartsOnMonday = plannerState.value.weekStartsOnMonday;

  return (
    <div class="border-b border-slate-800/70 bg-slate-900/50 backdrop-blur-sm">
      <div class="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="mr-1 text-xs font-medium text-slate-400">
            Paint Mode (Click or Drag):
          </span>

          {BRUSHES.map((b) => {
            const isActive = current === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => (activeBrush.value = b.id)}
                title={`${b.desc} (Shortcut: ${b.shortcut})`}
                class={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? b.activeClass
                    : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <span class={`h-2.5 w-2.5 rounded-full ${b.badgeClass}`} />
                <span>{b.label}</span>
                <kbd class="rounded bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 group-hover:text-slate-300">
                  {b.shortcut}
                </kbd>
              </button>
            );
          })}
        </div>

        <div class="flex items-center gap-4 text-xs text-slate-400">
          {/* Legend */}
          <div class="hidden lg:flex items-center gap-3">
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-rose-500/40 border border-rose-500/70" />
              Public Holiday
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-violet-500/30 border border-violet-400/70 border-dashed" />
              Bridge Hint
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm bg-slate-800" />
              Weekend
            </span>
          </div>

          <button
            type="button"
            onClick={toggleWeekStart}
            class="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
            title="Toggle first day of week between Monday and Sunday"
          >
            Week starts: <strong>{weekStartsOnMonday ? 'Mon' : 'Sun'}</strong>
          </button>
        </div>
      </div>
    </div>
  );
}
