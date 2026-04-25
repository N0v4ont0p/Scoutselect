const GRAPHQL_ENDPOINT = "https://api.ftcscout.org/graphql";
const GQL_TIMEOUT_MS = 10_000; // 10 s — avoids hanging forever during events

// ---------- GraphQL helper ----------
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GQL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error("FTCScout API timed out — please try again");
    }
    throw err;
  }
  clearTimeout(timer);
  if (!res.ok) throw new Error(`FTCScout API unavailable (HTTP ${res.status})`);
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
// Returns the correct inline fragment(s) for match scores based on the season.
// GraphQL type names: MatchScores2019, MatchScores2020Trad, MatchScores2020Remote,
//   MatchScores2021Trad, MatchScores2021Remote, MatchScores2022, MatchScores2023,
//   MatchScores2024, MatchScores2025 (each with red/blue nested alliance objects).
// 2019-2023 have egPoints; 2024+ have no endgame phase.
function scoreFragment(season: number): string {
  const hasEg = season <= 2023;
  const egField = hasEg ? " egPoints" : "";

  if (season === 2020) {
    return `
      scores {
        ... on MatchScores2020Trad {
          red { totalPointsNp autoPoints dcPoints${egField} }
          blue { totalPointsNp autoPoints dcPoints${egField} }
        }
        ... on MatchScores2020Remote {
          totalPointsNp autoPoints dcPoints${egField}
        }
      }`;
  }
  if (season === 2021) {
    return `
      scores {
        ... on MatchScores2021Trad {
          red { totalPointsNp autoPoints dcPoints${egField} }
          blue { totalPointsNp autoPoints dcPoints${egField} }
        }
        ... on MatchScores2021Remote {
          totalPointsNp autoPoints dcPoints${egField}
        }
      }`;
  }
  // 2019, 2022, 2023, 2024, 2025 — single wrapper type with red/blue
  return `
    scores {
      ... on MatchScores${season} {
        red { totalPointsNp autoPoints dcPoints${egField} }
        blue { totalPointsNp autoPoints dcPoints${egField} }
      }
    }`;
}

// ---------- Rankings stats fragment ----------
// Returns inline fragments for TeamEventStats union (per-season types).
function statsFragment(season: number): string {
  const body = "rank wins losses ties rp tb1 qualMatchesPlayed max { totalPointsNp }";
  if (season === 2020) {
    return `... on TeamEventStats2020Trad { ${body} }\n... on TeamEventStats2020Remote { ${body} }`;
  }
  if (season === 2021) {
    return `... on TeamEventStats2021Trad { ${body} }\n... on TeamEventStats2021Remote { ${body} }`;
  }
  return `... on TeamEventStats${season} { ${body} }`;
}

// ---------- Preview stats fragment (minimal, for batch queries) ----------
function previewStatsFragment(season: number): string {
  const body = "wins losses ties qualMatchesPlayed max { totalPointsNp } avg { totalPointsNp }";
  if (season === 2020) {
    return `... on TeamEventStats2020Trad { ${body} }\n... on TeamEventStats2020Remote { ${body} }`;
  }
  if (season === 2021) {
    return `... on TeamEventStats2021Trad { ${body} }\n... on TeamEventStats2021Remote { ${body} }`;
  }
  return `... on TeamEventStats${season} { ${body} }`;
}

// ---------- Pre-event scout data ----------
export interface PreviewTeam {
  teamNumber: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  matchesPlayed: number;
  eventsPlayed: number;
  highScore: number;
  winRate: number;
  /** Weighted average total score across all finished events this season. */
  avgScore: number;
}

/** Max teams per batch GraphQL alias query — keeps query size reasonable for the FTCScout API. */
const BATCH_CHUNK_SIZE = 15;

/** Fetch season stats for a batch of teams (used for upcoming-event preview). */
export async function getTeamsBatchSeasonStats(
  teamNumbers: number[],
  season: number
): Promise<PreviewTeam[]> {
  if (!teamNumbers.length) return [];

  // Split into chunks to avoid huge queries
  const chunkSize = BATCH_CHUNK_SIZE;
  const results: PreviewTeam[] = [];
  for (let i = 0; i < teamNumbers.length; i += chunkSize) {
    const chunk = teamNumbers.slice(i, i + chunkSize);
    const frag = previewStatsFragment(season);
    // Build a multi-alias batch query
    const aliases = chunk
      .map(
        (n) => `
      t${n}: teamByNumber(number: ${n}) {
        number
        name
        events(season: ${season}) {
          event { finished }
          stats { ${frag} }
        }
      }`
      )
      .join("\n");
    const q = `query BatchPreview { ${aliases} }`;

    interface RawStats {
      wins?: number;
      losses?: number;
      ties?: number;
      qualMatchesPlayed?: number;
      max?: { totalPointsNp: number };
      avg?: { totalPointsNp: number };
    }
    interface RawTeam {
      number: number;
      name: string;
      events: {
        event: { finished: boolean };
        stats: RawStats | null;
      }[];
    }
    type BatchResult = Record<string, RawTeam | null>;

    try {
      const data = await gql<BatchResult>(q);
      for (const n of chunk) {
        const team = data[`t${n}`];
        if (!team) continue;
        const done = team.events.filter((e) => e.event.finished && e.stats);
        const wins = done.reduce((s, e) => s + (e.stats?.wins ?? 0), 0);
        const losses = done.reduce((s, e) => s + (e.stats?.losses ?? 0), 0);
        const ties = done.reduce((s, e) => s + (e.stats?.ties ?? 0), 0);
        const played = done.reduce((s, e) => s + (e.stats?.qualMatchesPlayed ?? 0), 0);
        const highScore = Math.max(0, ...done.map((e) => e.stats?.max?.totalPointsNp ?? 0));
        // Weighted average total score across all finished events
        const totalWeighted = done.reduce(
          (s, e) => s + (e.stats?.avg?.totalPointsNp ?? 0) * (e.stats?.qualMatchesPlayed ?? 0),
          0
        );
        const avgScore = played > 0 ? totalWeighted / played : 0;
        results.push({
          teamNumber: n,
          name: team.name,
          wins,
          losses,
          ties,
          matchesPlayed: played,
          eventsPlayed: done.length,
          highScore,
          winRate: played > 0 ? wins / played : 0,
          avgScore,
        });
      }
    } catch {
      // If a chunk fails, add placeholder entries so the UI still shows team numbers
      for (const n of chunk) {
        results.push({
          teamNumber: n,
          name: `Team ${n}`,
          wins: 0,
          losses: 0,
          ties: 0,
          matchesPlayed: 0,
          eventsPlayed: 0,
          highScore: 0,
          winRate: 0,
          avgScore: 0,
        });
      }
    }
  }
  return results;
}

// ---------- API functions ----------
export async function searchTeams(query: string): Promise<FTCTeam[]> {
  const q = `
    query TeamsSearch($searchText: String, $limit: Int) {
      teamsSearch(searchText: $searchText, limit: $limit) {
        number
        name
        schoolName
        location { city state country }
      }
    }`;
  interface SearchResult {
    teamsSearch: {
      number: number;
      name: string;
      schoolName: string;
      location: { city: string; state: string; country: string };
    }[];
  }
  const data = await gql<SearchResult>(q, { searchText: query, limit: 25 });
  return (data.teamsSearch ?? []).map((t) => ({
    teamNumber: t.number,
    nameShort: t.name,
    nameFull: t.name,
    schoolName: t.schoolName,
    city: t.location.city,
    stateProv: t.location.state,
    country: t.location.country,
  }));
}

export async function getTeam(number: number): Promise<FTCTeam> {
  const q = `
    query GetTeam($number: Int!) {
      teamByNumber(number: $number) {
        number
        name
        schoolName
        location { city state country }
      }
    }`;
  interface TeamResult {
    teamByNumber: {
      number: number;
      name: string;
      schoolName: string;
      location: { city: string; state: string; country: string };
    } | null;
  }
  const data = await gql<TeamResult>(q, { number });
  const t = data.teamByNumber;
  if (!t) throw new Error(`Team ${number} not found`);
  return {
    teamNumber: t.number,
    nameShort: t.name,
    nameFull: t.name,
    schoolName: t.schoolName,
    city: t.location.city,
    stateProv: t.location.state,
    country: t.location.country,
  };
}

export async function getTeamEvents(number: number, season: number): Promise<FTCEvent[]> {
  const q = `
    query GetTeamEvents($number: Int!, $season: Int!) {
      teamByNumber(number: $number) {
        events(season: $season) {
          event {
            season
            code
            name
            type
            location { city state country }
            start
            end
            ongoing
            finished
          }
        }
      }
    }`;
  interface TeamEventsResult {
    teamByNumber: {
      events: {
        event: {
          season: number;
          code: string;
          name: string;
          type: string;
          location: { city: string; state: string; country: string };
          start: string;
          end: string;
          ongoing: boolean;
          finished: boolean;
        };
      }[];
    } | null;
  }
  const data = await gql<TeamEventsResult>(q, { number, season });
  return (data.teamByNumber?.events ?? []).map((e) => ({
    season: e.event.season,
    code: e.event.code,
    name: e.event.name,
    type: e.event.type,
    city: e.event.location.city,
    stateProv: e.event.location.state,
    country: e.event.location.country,
    start: e.event.start,
    end: e.event.end,
    ongoing: e.event.ongoing,
    finished: e.event.finished,
  }));
}

export async function getSeasons(): Promise<number[]> {
  return [2019, 2020, 2021, 2022, 2023, 2024, 2025];
}

// ---------- Season events (for live/upcoming display and event search) ----------
export interface FTCEventSummary {
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

export async function getSeasonEvents(season: number): Promise<FTCEventSummary[]> {
  const q = `
    query SeasonEvents($season: Int!) {
      eventsSearch(season: $season) {
        season
        code
        name
        type
        location { city state country }
        start
        end
        ongoing
        finished
      }
    }`;
  interface SeasonEventsResult {
    eventsSearch: {
      season: number;
      code: string;
      name: string;
      type: string;
      location: { city: string; state: string; country: string };
      start: string;
      end: string;
      ongoing: boolean;
      finished: boolean;
    }[];
  }
  const data = await gql<SeasonEventsResult>(q, { season });
  return (data.eventsSearch ?? []).map((e) => ({
    season: e.season,
    code: e.code,
    name: e.name,
    type: e.type,
    city: e.location.city,
    stateProv: e.location.state,
    country: e.location.country,
    start: e.start,
    end: e.end,
    ongoing: e.ongoing,
    finished: e.finished,
  }));
}

export async function getEvent(season: number, code: string): Promise<FTCEvent> {
  const q = `
    query GetEvent($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        season
        code
        name
        type
        location { city state country }
        start
        end
        ongoing
        finished
      }
    }`;
  interface EventResult {
    eventByCode: {
      season: number;
      code: string;
      name: string;
      type: string;
      location: { city: string; state: string; country: string };
      start: string;
      end: string;
      ongoing: boolean;
      finished: boolean;
    } | null;
  }
  const data = await gql<EventResult>(q, { season, code });
  const ev = data.eventByCode;
  if (!ev) throw new Error(`Event ${season}/${code} not found`);
  return {
    season: ev.season,
    code: ev.code,
    name: ev.name,
    type: ev.type,
    city: ev.location.city,
    stateProv: ev.location.state,
    country: ev.location.country,
    start: ev.start,
    end: ev.end,
    ongoing: ev.ongoing,
    finished: ev.finished,
  };
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
    // Remote matches (2020/2021) are flat objects without red/blue wrappers
    const red = sc?.red ?? {};
    const blue = sc?.blue ?? {};

    const egKey = season <= 2023 ? "egPoints" : null;
    // Use no-penalty scores (totalPointsNp) so penalty-inflated scores don't skew analytics
    const redNp = red.totalPointsNp ?? red.totalPoints ?? null;
    const blueNp = blue.totalPointsNp ?? blue.totalPoints ?? null;

    return {
      matchNum: m.matchNum,
      series: m.series,
      tournamentLevel: m.tournamentLevel,
      redScore: redNp,
      blueScore: blueNp,
      redTeams,
      blueTeams,
      totalPoints: (redNp ?? 0) + (blueNp ?? 0),
      autoPoints: (red.autoPoints ?? 0) + (blue.autoPoints ?? 0),
      dcPoints: (red.dcPoints ?? 0) + (blue.dcPoints ?? 0),
      endgamePoints: egKey ? (red[egKey] ?? 0) + (blue[egKey] ?? 0) : 0,
    };
  });
}

interface TeamsQueryResult {
  eventByCode: {
    teams: { teamNumber: number }[];
  };
}

export async function getEventTeams(season: number, code: string): Promise<number[]> {
  const q = `
    query EventTeams($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        teams { teamNumber }
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
        tb1: number;
        qualMatchesPlayed: number;
        max: { totalPointsNp: number };
      } | null;
    }[];
  };
}

export async function getEventRankings(season: number, code: string): Promise<FTCRanking[]> {
  const fragment = statsFragment(season);
  const q = `
    query EventRankings($season: Int!, $code: String!) {
      eventByCode(season: $season, code: $code) {
        teams {
          teamNumber
          stats {
            ${fragment}
          }
        }
      }
    }`;
  const data = await gql<RankingsQueryResult>(q, { season, code });
  return (data.eventByCode?.teams ?? [])
    .filter((t) => t.stats)
    .map((t) => ({
      teamNumber: t.teamNumber,
      rank: t.stats!.rank,
      wins: t.stats!.wins,
      losses: t.stats!.losses,
      ties: t.stats!.ties,
      rp: t.stats!.rp,
      tbp: t.stats!.tb1,
      highScore: t.stats!.max?.totalPointsNp ?? 0,
      matchesPlayed: t.stats!.qualMatchesPlayed,
    }))
    .sort((a, b) => a.rank - b.rank);
}
