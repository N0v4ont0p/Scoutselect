import { getTeam, getTeamEvents, FTCScoutError, upstreamErrorMessage } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import TeamDetailClient from "@/components/TeamDetailClient";
import TeamNotFound from "@/components/TeamNotFound";

export default async function TeamDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const teamNum = parseInt(number, 10);
  const currentSeason = getCurrentSeason();

  let team = null;
  let events: { season: number; code: string; name: string; city: string; stateProv: string; start: string; finished: boolean }[] = [];
  let upstreamUnavailable = false;
  let upstreamMsg: string | undefined;

  try {
    [team, events] = await Promise.all([
      getTeam(teamNum),
      getTeamEvents(teamNum, currentSeason),
    ]);
  } catch (err) {
    if (err instanceof FTCScoutError) {
      upstreamUnavailable = true;
      upstreamMsg = upstreamErrorMessage(err);
      console.error(`[teams/${teamNum}] FTCScout error:`, err);
    }
    // Otherwise: team not found (GraphQL null) — upstreamUnavailable stays false
  }

  if (!team) {
    return <TeamNotFound teamNum={teamNum} upstreamUnavailable={upstreamUnavailable} upstreamMessage={upstreamMsg} />;
  }

  return (
    <TeamDetailClient
      team={team}
      events={events}
      teamNum={teamNum}
      currentSeason={currentSeason}
    />
  );
}

