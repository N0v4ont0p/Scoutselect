const GRAPHQL_ENDPOINT = "https://api.ftcscout.org/graphql";
const REST_BASE = "https://api.ftcscout.org/rest/v1";

// ---------- REST helpers ----------
async function restGet<T>(path: string): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FTCScout REST ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ---------- GraphQL helper ----------
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`FTCScout GraphQL ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// ---------- Types ----------
export interface FTCTeam {
  teamNumber: number;
  nameShort: string;
  nameFull: string;
  schoolName: string;
  city: string;
  stateProv: string;
  country: string;
}

export interface FTCEvent {
  season: number;
  code: string;
  name: string;
  type: string;
  city: string;
  stateProv: string;
  country: string;
  start: string;
  end: string;
  ongoing: boolean;
  finished: boolean;
}

export interface FTCMatch {
  matchNum: number;
  series: number;
  tournamentLevel: string;
  redScore: number | null;
  blueScore: number | null;
  redTeams: number[];
  blueTeams: number[];
  totalPoints: number;
  autoPoints: number;
  dcPoints: number;
  endgamePoints: number;
}

export interface FTCRanking {
  rank: number;
  teamNumber: number;
  wins: number;
  losses: number;
  ties: number;
  rp: number;
  tbp: number;
  highScore: number;
  matchesPlayed: number;
}

// ---------- Season score fragment ----------
function scoreFragment(season: number): string {
  if (season <= 2023) {
    return `
      scores {
        ... on MatchScores${season}Traditional {
          red { totalPoints autoPoints dcPoints egPoints }
          blue { totalPoints autoPoints dcPoints egPoints }
        }
        ... on MatchScores${season}Remote {
          team { totalPoints autoPoints dcPoints egPoints }
        }
      }`;
  }
  return `
    scores {
      ... on MatchScores${season}Traditional {
        red { totalPoints autoPoints dcPoints endgamePoints }
        blue { totalPoints autoPoints dcPoints endgamePoints }
      }
      ... on MatchScores${season}Remote {
        team { totalPoints autoPoints dcPoints endgamePoints }
      }
    }`;
}

// ---------- API functions ----------
export async function searchTeams(query: string): Promise<FTCTeam[]> {
  return restGet<FTCTeam[]>(`/teams?search=${encodeURIComponent(query)}&limit=10`);
}

export async function getTeam(number: number): Promise<FTCTeam> {
  return restGet<FTCTeam>(`/teams/${number}`);
}

export async function getTeamEvents(number: number, season: number): Promise<FTCEvent[]> {
  return restGet<FTCEvent[]>(`/teams/${number}/events?season=${season}`);
}

export async function getSeasons(): Promise<number[]> {
  return [2019, 2020, 2021, 2022, 2023, 2024, 2025];
}

export async function getEvent(season: number, code: string): Promise<FTCEvent> {
  return restGet<FTCEvent>(`/events/${season}/${code}`);
}

interface MatchesQueryResult {
  eventByCode: {
    matches: {
      matchNum: number;
      series: number;
      tournamentLevel: string;
      teams: { teamNumber: number; alliance: string; allianceRole: string }[];
      scores: unknown;
    }[];
  };
}

export async function getEventMatches(season: number, code: string): Promise<FTCMatch[]> {
  const q = `
    query EventMatches($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        matches {
          matchNum
          series
          tournamentLevel
          teams { teamNumber alliance allianceRole }
          ${scoreFragment(season)}
        }
      }
    }`;
  const data = await gql<MatchesQueryResult>(q, { season, code });
  const raw = data.eventByCode?.matches ?? [];

  return raw.map((m) => {
    const redTeams = m.teams.filter((t) => t.alliance === "Red").map((t) => t.teamNumber);
    const blueTeams = m.teams.filter((t) => t.alliance === "Blue").map((t) => t.teamNumber);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = m.scores as any;
    const red = sc?.red ?? sc?.team ?? {};
    const blue = sc?.blue ?? {};

    const egKey = season <= 2023 ? "egPoints" : "endgamePoints";

    return {
      matchNum: m.matchNum,
      series: m.series,
      tournamentLevel: m.tournamentLevel,
      redScore: red.totalPoints ?? null,
      blueScore: blue.totalPoints ?? null,
      redTeams,
      blueTeams,
      totalPoints: (red.totalPoints ?? 0) + (blue.totalPoints ?? 0),
      autoPoints: (red.autoPoints ?? 0) + (blue.autoPoints ?? 0),
      dcPoints: (red.dcPoints ?? 0) + (blue.dcPoints ?? 0),
      endgamePoints: (red[egKey] ?? 0) + (blue[egKey] ?? 0),
    };
  });
}

interface TeamsQueryResult {
  eventByCode: {
    teams: { teamNumber: number; hasStats: boolean }[];
  };
}

export async function getEventTeams(season: number, code: string): Promise<number[]> {
  const q = `
    query EventTeams($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        teams { teamNumber hasStats }
      }
    }`;
  const data = await gql<TeamsQueryResult>(q, { season, code });
  return (data.eventByCode?.teams ?? []).map((t) => t.teamNumber);
}

interface RankingsQueryResult {
  eventByCode: {
    teams: {
      teamNumber: number;
      stats: {
        rank: number;
        wins: number;
        losses: number;
        ties: number;
        rp: number;
        tbp: number;
        highScore: number;
        matchesPlayed: number;
      } | null;
    }[];
  };
}

export async function getEventRankings(season: number, code: string): Promise<FTCRanking[]> {
  const q = `
    query EventRankings($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        teams {
          teamNumber
          stats {
            rank wins losses ties rp tbp highScore matchesPlayed
          }
        }
      }
    }`;
  const data = await gql<RankingsQueryResult>(q, { season, code });
  return (data.eventByCode?.teams ?? [])
    .filter((t) => t.stats)
    .map((t) => ({ teamNumber: t.teamNumber, ...t.stats! }))
    .sort((a, b) => a.rank - b.rank);
}
