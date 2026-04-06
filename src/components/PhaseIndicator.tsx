import type { EventPhase } from '@/lib/analytics';

const phaseConfig: Record<EventPhase, { label: string; dot: string; bg: string; text: string; live: boolean }> = {
  QUALS_RUNNING:               { label: 'Quals Live',        dot: 'bg-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30',  text: 'text-blue-300',  live: true  },
  QUALS_DONE_SELECTION_PENDING:{ label: 'Alliance Selection',dot: 'bg-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30',text: 'text-amber-300', live: false },
  ALLIANCE_SELECTION_OR_POSTED:{ label: 'Alliances Set',     dot: 'bg-orange-400', bg: 'bg-orange-500/15 border-orange-500/30',text:'text-orange-300',live: false },
  PLAYOFFS_RUNNING:            { label: 'Playoffs Live',     dot: 'bg-red-400',    bg: 'bg-red-500/15 border-red-500/30',    text: 'text-red-300',   live: true  },
  EVENT_COMPLETE:              { label: 'Complete',          dot: 'bg-slate-400',  bg: 'bg-slate-500/15 border-slate-500/30',text: 'text-slate-300', live: false },
};

export function PhaseIndicator({ phase }: { phase: EventPhase }) {
  const cfg = phaseConfig[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.live ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

