import { useEffect, useMemo, useState } from 'preact/hooks';
import { Loader2 } from 'lucide-preact';
import { TopBar } from './TopBar';
import { PlanTabsBar } from './PlanTabsBar';
import { BrushToolbar } from './BrushToolbar';
import { CalendarGrid } from './CalendarGrid';
import { LinearYearView } from './LinearYearView';
import { TripsSidebar } from './TripsSidebar';
import { OverlaysPanel } from './OverlaysPanel';
import { DayTooltip, forceHideDayTooltip } from './DayTooltip';
import {
  activeBrush,
  applyBrushToDates,
  importStateFromJson,
  initStoreFromStorage,
  isHydrated,
  leftPanelOpen,
  plannerState,
  redo,
  undo,
  zoomIn,
  zoomLevel,
  zoomOut,
} from '../store/plannerStore';
import { getDatesBetween } from '../lib/dateUtils';

export default function PlannerApp() {
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragCurrent, setDragCurrent] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Hydrate state from localStorage on client mount to avoid SSR hydration mismatch
  useEffect(() => {
    initStoreFromStorage();
  }, []);

  const selectedRange = useMemo(() => {
    if (!dragStart || !dragCurrent) return [];
    return getDatesBetween(dragStart, dragCurrent);
  }, [dragStart, dragCurrent]);

  const selectedRangeSet = useMemo(() => new Set(selectedRange), [selectedRange]);

  const handleDayPointerDown = (ymd: string, e: MouseEvent) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    forceHideDayTooltip();
    setDragStart(ymd);
    setDragCurrent(ymd);
  };

  const handleDayPointerEnter = (ymd: string) => {
    if (!dragStart) return;
    setDragCurrent(ymd);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragStart && dragCurrent) {
        const range = getDatesBetween(dragStart, dragCurrent);
        applyBrushToDates(range, activeBrush.value);
      }
      setDragStart(null);
      setDragCurrent(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragStart, dragCurrent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'c') activeBrush.value = 'confirmed';
      else if (key === 'd') activeBrush.value = 'draft';
      else if (key === 'h') activeBrush.value = 'half-confirmed';
      else if (key === 'g') activeBrush.value = 'half-draft';
      else if (key === 'p') activeBrush.value = 'holiday';
      else if (key === 'e') activeBrush.value = 'erase';
      else if (key === '=' || key === '+') zoomIn();
      else if (key === '-') zoomOut();
      else if (key === '1') zoomLevel.value = 'year-linear';
      else if (key === '2') zoomLevel.value = 'year-grid';
      else if (key === '3') zoomLevel.value = '6-months';
      else if (key === '4') zoomLevel.value = 'quarter';
      else if (key === '5') zoomLevel.value = 'month';
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag & drop JSON anywhere on the page
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.json') || file.type === 'application/json') {
      const text = await file.text();
      importStateFromJson(text);
    }
  };

  const currentZoom = zoomLevel.value;
  const hydrated = isHydrated.value;
  // Subscribe to plannerState at root so changes trigger clean updates
  const _currentYear = plannerState.value.year;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      class="min-h-screen flex flex-col bg-slate-950 text-slate-100"
    >
      {/* Blocking Loading Modal while Hydrating / Fetching Saved Planner Data */}
      {!hydrated && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md"
        >
          <div class="flex flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/95 px-10 py-8 text-center shadow-2xl">
            <div class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 border border-indigo-500/30">
              <Loader2 class="h-6 w-6 animate-spin text-indigo-400" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-white tracking-wide">
                Loading your planner…
              </h2>
              <p class="mt-1 text-xs text-slate-400">
                Restoring saved vacations, plans, and settings
              </p>
            </div>
          </div>
        </div>
      )}

      {isDraggingFile && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div class="rounded-3xl border-2 border-dashed border-indigo-400 bg-slate-900/90 px-12 py-10 text-center shadow-2xl">
            <p class="text-lg font-bold text-white">Drop JSON file to import plan</p>
            <p class="mt-1 text-sm text-slate-400">
              Your calendar and PTO settings will be restored immediately
            </p>
          </div>
        </div>
      )}

      <TopBar />
      <PlanTabsBar />
      <BrushToolbar />
      <DayTooltip />

      <main class="mx-auto flex-1 w-full max-w-[1800px] px-4 py-5">
        <div
          class={`grid grid-cols-1 gap-5 items-start ${
            leftPanelOpen.value
              ? 'xl:grid-cols-[330px_1fr_350px]'
              : 'xl:grid-cols-[52px_1fr_350px]'
          }`}
        >
          {/* Left Collapsible Panel: YAML Overlays (School Holidays, Surfing, Diving) */}
          <OverlaysPanel />

          {/* Main Calendar View */}
          <div class="min-w-0">
            {currentZoom === 'year-linear' ? (
              <LinearYearView
                selectedRangeSet={selectedRangeSet}
                onDayPointerDown={handleDayPointerDown}
                onDayPointerEnter={handleDayPointerEnter}
              />
            ) : (
              <CalendarGrid
                selectedRangeSet={selectedRangeSet}
                onDayPointerDown={handleDayPointerDown}
                onDayPointerEnter={handleDayPointerEnter}
              />
            )}
          </div>

          {/* Right Sidebar: Trips & Bridge Opportunities */}
          <TripsSidebar />
        </div>
      </main>

      <footer class="border-t border-slate-900 bg-slate-950 px-4 py-3 text-center text-xs text-slate-500">
        <div class="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2">
          <span>
            Shortcuts: <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">C</kbd> Confirmed •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">D</kbd> Draft •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">H</kbd> Half-Day •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">P</kbd> Holiday •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">E</kbd> Erase •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">1–5</kbd> Zoom Levels •{' '}
            <kbd class="rounded bg-slate-900 px-1.5 py-0.5 text-slate-400">Cmd/Ctrl+Z/Y</kbd> Undo/Redo
          </span>
          <span>Auto-saved to browser storage • Export JSON to backup file or drag & drop .json to load</span>
        </div>
      </footer>
    </div>
  );
}
