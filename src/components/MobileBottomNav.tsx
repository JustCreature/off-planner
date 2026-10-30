import { Calendar, Plane, Layers } from 'lucide-preact';
import {
  mobileActiveSection,
  plannerState,
  vacationBlocks,
  leftPanelOpen,
} from '../store/plannerStore';
import { OVERLAY_CONFIGS } from '../lib/overlays';

export function MobileBottomNav() {
  const active = mobileActiveSection.value;
  const state = plannerState.value;
  const tripsCount = vacationBlocks.value.length;
  const enabledOverlaysCount = OVERLAY_CONFIGS.filter(
    (c) => state.overlayPrefs?.[c.id]?.enabled
  ).length;
  const plannedDaysCount = Object.keys(state.days).filter((d) =>
    d.startsWith(`${state.year}-`)
  ).length;

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Mobile view navigation"
      class="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-2 py-1.5 backdrop-blur-md md:hidden"
    >
      <div class="mx-auto grid max-w-md grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => (mobileActiveSection.value = 'calendar')}
          class={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
            active === 'calendar'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div class="relative flex items-center">
            <Calendar class="h-4 w-4" />
            {plannedDaysCount > 0 && (
              <span class="ml-1 rounded-full bg-emerald-500/25 px-1.5 text-[9px] font-extrabold text-emerald-300">
                {plannedDaysCount}d
              </span>
            )}
          </div>
          <span>Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => (mobileActiveSection.value = 'trips')}
          class={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
            active === 'trips'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div class="relative flex items-center">
            <Plane class="h-4 w-4" />
            <span class="ml-1 rounded-full bg-slate-800 px-1.5 text-[9px] font-bold text-slate-300">
              {tripsCount}
            </span>
          </div>
          <span>Trips & Holidays</span>
        </button>

        <button
          type="button"
          onClick={() => {
            leftPanelOpen.value = true;
            mobileActiveSection.value = 'overlays';
          }}
          class={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
            active === 'overlays'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div class="relative flex items-center">
            <Layers class="h-4 w-4" />
            {enabledOverlaysCount > 0 && (
              <span class="ml-1 rounded-full bg-cyan-500/25 px-1.5 text-[9px] font-extrabold text-cyan-300">
                {enabledOverlaysCount}
              </span>
            )}
          </div>
          <span>Overlays</span>
        </button>
      </div>
    </nav>
  );
}
