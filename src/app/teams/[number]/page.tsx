import { getTeam, getTeamEvents } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import TeamDetailClient from "@/components/TeamDetailClient";
import TeamNotFound from "@/components/TeamNotFound";

export default async function TeamDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const teamNum = parseInt(number, 10);
  const currentSeason = getCurrentSeason();

  let team = null;
  let events: { season: number; code: string; name: string; city: string; stateProv: string; start: string; finished: boolean }[] = [];

  try {
    [team, events] = await Promise.all([
      getTeam(teamNum),
      getTeamEvents(teamNum, currentSeason),
    ]);
  } catch { /* team not found */ }

  if (!team) {
    return <TeamNotFound teamNum={teamNum} />;
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

