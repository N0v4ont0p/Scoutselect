import { request, gql } from 'graphql-request';

const GRAPHQL_ENDPOINT = 'https://api.ftcscout.org/graphql';
const REST_BASE = 'https://api.ftcscout.org/rest/v1';

export interface TeamSearchResult {
  number: number;
  name: string;
  schoolName?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Team {
  number: number;
  name: string;
  schoolName?: string;
  sponsors?: string[];
  city?: string;
  state?: string;
  country?: string;
  rookieYear?: number;
}

export interface EventLocation {
  city?: string;
  state?: string;
  country?: string;
}

export interface TeamEvent {
  event: {
    name: string;
    code: string;
    start: string;
    end: string;
    season: number;
    location?: EventLocation;
  };
}

export interface MatchTeam {
  teamNumber: number;
  station: string;
  dq: boolean;
  surrogate: boolean;
  alliance: string;
}

export interface AllianceScores {
  totalPoints: number;
  autoPoints: number;
  dcPoints: number;
  endgamePoints: number;
  penaltyPointsCommitted: number;
}

export interface Match {
  id: string;
  matchNum: number;
  series: number;
  tournamentLevel: string;
  teams: MatchTeam[];
  scores?: {
    red?: AllianceScores;
    blue?: AllianceScores;
  };
  winner?: string;
  played: boolean;
}

export interface TeamStats {
  rank: number;
  rp?: number;
  tbp?: number;
  wins: number;
  losses: number;
  ties: number;
  qualMatchesPlayed: number;
  tot?: {
    totalPoints?: number;
    autoPoints?: number;
    dcPoints?: number;
    endgamePoints?: number;
    penaltyPointsCommitted?: number;
    n?: number;
    mean?: number;
  };
}

export interface EventTeam {
  team: {
    number: number;
    name: string;
  };
  stats?: TeamStats;
}

export interface Ranking {
  teamNumber: number;
  teamName: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  rp?: number;
  tbp?: number;
  qualMatchesPlayed: number;
}

async function restFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`FTCScout REST error: ${res.status} ${path}`);
  return res.json();
}

export async function searchTeams(query: string): Promise<TeamSearchResult[]> {
  try {
    return await restFetch<TeamSearchResult[]>(`/teams/search?query=${encodeURIComponent(query)}&limit=5`);
  } catch {
    return [];
  }
}

export async function getTeam(number: number): Promise<Team | null> {
  try {
    return await restFetch<Team>(`/teams/${number}`);
  } catch {
    return null;
  }
}

const TEAM_EVENTS_QUERY = gql`
  query TeamEvents($number: Int!, $season: Int!) {
    teamByNumber(number: $number) {
      name
      rookieYear
      events(season: $season) {
        event {
          name
          code
          start
          end
          season
          location {
            city
            state
            country
          }
        }
      }
    }
  }
`;

export async function getTeamEvents(teamNumber: number, season: number): Promise<TeamEvent[]> {
  try {
    const data = await request<{ teamByNumber?: { events?: TeamEvent[] } }>(
      GRAPHQL_ENDPOINT,
      TEAM_EVENTS_QUERY,
      { number: teamNumber, season }
    );
    return data.teamByNumber?.events ?? [];
  } catch {
    return [];
  }
}

const EVENT_MATCHES_QUERY = gql`
  query EventMatches($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
      name
      matches {
        id
        matchNum
        series
        tournamentLevel
        teams {
          teamNumber
          station
          dq
          surrogate
          alliance
        }
        scores {
          ... on MatchScores2025 {
            red { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
            blue { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
          }
          ... on MatchScores2024 {
            red { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
            blue { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
          }
          ... on MatchScores2023 {
            red { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
            blue { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
          }
          ... on MatchScores2022 {
            red { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
            blue { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted }
          }
        }
        winner
        played
      }
    }
  }
`;

export async function getEventMatches(season: number, code: string): Promise<Match[]> {
  try {
    const data = await request<{ eventByCode?: { matches?: Match[] } }>(
      GRAPHQL_ENDPOINT,
      EVENT_MATCHES_QUERY,
      { season, code }
    );
    return data.eventByCode?.matches ?? [];
  } catch {
    return [];
  }
}

const EVENT_RANKINGS_QUERY = gql`
  query EventRankings($season: Int!, $code: String!) {
    eventByCode(season: $season, code: $code) {
      teams {
        team { number name }
        stats {
          ... on TeamEventStats2025 {
            rank rp tbp wins losses ties qualMatchesPlayed
            tot { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted n mean }
          }
          ... on TeamEventStats2024 {
            rank rp tbp wins losses ties qualMatchesPlayed
            tot { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted n mean }
          }
          ... on TeamEventStats2023 {
            rank rp tbp wins losses ties qualMatchesPlayed
            tot { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted n mean }
          }
          ... on TeamEventStats2022 {
            rank rp tbp wins losses ties qualMatchesPlayed
            tot { totalPoints autoPoints dcPoints endgamePoints penaltyPointsCommitted n mean }
          }
        }
      }
    }
  }
`;

export async function getEventRankings(season: number, code: string): Promise<EventTeam[]> {
  try {
    const data = await request<{ eventByCode?: { teams?: EventTeam[] } }>(
      GRAPHQL_ENDPOINT,
      EVENT_RANKINGS_QUERY,
      { season, code }
    );
    return data.eventByCode?.teams ?? [];
  } catch {
    return [];
  }
}

export async function getEventTeams(season: number, code: string): Promise<EventTeam[]> {
  return getEventRankings(season, code);
}
