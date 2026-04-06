import type { EventPhase } from '@/lib/analytics';

const phaseConfig: Record<EventPhase, { label: string; color: string }> = {
  QUALS_RUNNING: { label: 'Quals Running', color: 'bg-blue-500' },
  QUALS_DONE_SELECTION_PENDING: { label: 'Alliance Selection', color: 'bg-yellow-500' },
  ALLIANCE_SELECTION_OR_POSTED: { label: 'Alliances Posted', color: 'bg-orange-500' },
  PLAYOFFS_RUNNING: { label: 'Playoffs', color: 'bg-red-500' },
  EVENT_COMPLETE: { label: 'Complete', color: 'bg-gray-500' },
};

export function PhaseIndicator({ phase }: { phase: EventPhase }) {
  const cfg = phaseConfig[phase];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
