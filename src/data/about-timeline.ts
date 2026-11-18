import type { JourneyItem, PortfolioContent } from './portfolio';

export interface AboutTimelineItem {
  org: string;
  role?: string;
  period: string;
  current?: boolean;
  sub: string[];
}

const DIO = 'DIO';
/** Separator shown between two dates of a period. */
const SEP = ' — ';
/** Separators accepted when reading a period: em/en dash or hyphen, surrounded by spaces. */
const SEP_RE = /\s+[—–-]\s+/;

const journeyItem = (c: PortfolioContent, id: string): JourneyItem => {
  const item = c.journey.items.find((i) => i.id === id);
  if (!item) throw new Error(`about-timeline: journey item "${id}" not found`);
  return item;
};

/** First and last date of a period ("Set 2022 — Out 2024"). Without a separator both are the whole text; empty text gives empty dates. */
export function splitPeriod(period: string): { start: string; end: string } {
  const parts = period.split(SEP_RE).map((p) => p.trim()).filter(Boolean);
  return { start: parts[0] ?? '', end: parts[parts.length - 1] ?? '' };
}

/** "start — end"; just one of them when the other is missing or they are equal; '' when both are missing. */
export function joinPeriod(start: string, end: string): string {
  return start && end && start !== end ? `${start}${SEP}${end}` : start || end;
}

/** "2023 — 2025" from the 20xx years found in the texts; a single year when there is only one; '' when there are none. */
export function yearRange(texts: string[]): string {
  const years = texts.flatMap((t) => t.match(/\b20\d\d\b/g) ?? []).map(Number);
  return years.length ? joinPeriod(String(Math.min(...years)), String(Math.max(...years))) : '';
}

/** Derives the 3 "Quem sou" timeline nodes (ALETO, SEBRAE, DIO) from existing portfolio data. */
export function aboutTimeline(c: PortfolioContent): AboutTimelineItem[] {
  const aleto = journeyItem(c, 'aleto');
  const uge = journeyItem(c, 'sebrae-uge');
  const ali = journeyItem(c, 'sebrae-ali');
  const awards = c.about.awards;

  const sebraeAward = awards.find((a) => a.meta.startsWith('SEBRAE'));
  const dioAwards = awards.filter((a) => a.meta.endsWith(DIO));

  const dioPeriod = yearRange(dioAwards.map((a) => a.title));

  const counts = new Map<string, number>();
  for (const a of dioAwards) counts.set(a.place, (counts.get(a.place) ?? 0) + 1);
  const dioSummary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([place, n]) => `${n}× ${place}`)
    .join(' · ');

  return [
    {
      org: aleto.company,
      role: aleto.role,
      period: aleto.period,
      current: aleto.current,
      sub: aleto.highlights.slice(0, 2),
    },
    {
      org: uge.company,
      // the SEBRAE tenure starts when the ALI one did and ends when the UGE one ended
      period: joinPeriod(splitPeriod(ali.period).start, splitPeriod(uge.period).end),
      sub: [
        `${uge.role} · ${uge.period}`,
        `${ali.role} · ${ali.period}`,
        ...(sebraeAward ? [`${sebraeAward.place} · ${sebraeAward.title}`] : []),
      ],
    },
    { org: DIO, period: dioPeriod, sub: dioSummary ? [dioSummary] : [] },
  ];
}
