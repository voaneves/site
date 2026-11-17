import type { Locale } from './ui';

export interface SeoStrings {
  inLanguage: string;
  jobTitle: string;
  alumniOf: string;
  knowsAbout: string[];
  awards: string[];
  catalogName: string;
  priceRange: string;
  areaServedCountry: string;
}

export const SEO: Record<Locale, SeoStrings> = {
  'pt-br': {
    inLanguage: 'pt-BR',
    jobTitle: 'Analista Webdesigner e Desenvolvedor Full Stack',
    alumniOf: 'UNICAMP — Universidade Estadual de Campinas',
    knowsAbout: [
      'Desenvolvimento full stack', 'Webdesigner', 'Java', 'Laravel', 'Angular', 'Astro', 'Jamstack', 'Serverless',
      'GitOps', 'Design system', 'Power BI', 'IA generativa', 'BPMN', 'Transformação digital',
    ],
    awards: [
      '1º Lugar · Santander Bootcamp 2025 Back-End Python (11.434 inscritos)',
      '2º Lugar · Santander Bootcamp 2025 Ciência de Dados com Python',
      '1º Lugar · Bootcamp Nexa IA Generativa & Claude 3',
      '1º Lugar · Santander Bootcamp 2023 Ciência de Dados (17.600 inscritos)',
    ],
    catalogName: 'Serviços Digitais e de Gestão',
    priceRange: 'R$ 90–R$ 1.500+',
    areaServedCountry: 'Brasil',
  },
  en: {
    inLanguage: 'en',
    jobTitle: 'Web Design Analyst and Full Stack Developer',
    alumniOf: 'UNICAMP — University of Campinas',
    knowsAbout: [
      'Full stack development', 'Web design', 'Java', 'Laravel', 'Angular', 'Astro', 'Jamstack', 'Serverless',
      'GitOps', 'Design system', 'Power BI', 'Generative AI', 'BPMN', 'Digital transformation',
    ],
    awards: [
      '1st Place · Santander Bootcamp 2025 Back-End Python (11,434 enrolled)',
      '2nd Place · Santander Bootcamp 2025 Data Science with Python',
      '1st Place · Nexa Bootcamp Generative AI & Claude 3',
      '1st Place · Santander Bootcamp 2023 Data Science (17,600 enrolled)',
    ],
    catalogName: 'Digital & Management Services',
    priceRange: 'BRL 90–1,500+',
    areaServedCountry: 'Brazil',
  },
};
