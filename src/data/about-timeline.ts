import type { JourneyItem, PortfolioContent } from './portfolio';

export interface AboutTimelineItem {
  org: string;
  role?: string;
  period: string;
  current?: boolean;
  sub: string[];
}

const DIO = 'DIO';
const SEP = ' — ';

const journeyItem = (c: PortfolioContent, id: string): JourneyItem => {
  const item = c.journey.items.find((i) => i.id === id);
  if (!item) throw new Error(`about-timeline: journey item "${id}" not found`);
  return item;
};

/** Derives the 3 "Quem sou" timeline nodes (ALETO, SEBRAE, DIO) from existing portfolio data. */
export function aboutTimeline(c: PortfolioContent): AboutTimelineItem[] {
  const aleto = journeyItem(c, 'aleto');
  const uge = journeyItem(c, 'sebrae-uge');
  const ali = journeyItem(c, 'sebrae-ali');
  const awards = c.about.awards;

  const sebraeAward = awards.find((a) => a.meta.startsWith('SEBRAE'));
  const dioAwards = awards.filter((a) => a.meta.endsWith(DIO));

  const years = dioAwards
    .flatMap((a) => a.title.match(/\b20\d\d\b/g) ?? [])
    .map(Number);
  const dioPeriod = years.length ? `${Math.min(...years)}${SEP}${Math.max(...years)}` : '';

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
      period: `${ali.period.split(SEP)[0]}${SEP}${uge.period.split(SEP)[1]}`,
      sub: [
        `${uge.role} · ${uge.period}`,
        `${ali.role} · ${ali.period}`,
        ...(sebraeAward ? [`${sebraeAward.place} · ${sebraeAward.title}`] : []),
      ],
    },
    { org: DIO, period: dioPeriod, sub: dioSummary ? [dioSummary] : [] },
  ];
}
