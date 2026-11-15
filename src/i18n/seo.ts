import type { Locale } from './ui';

export interface SeoStrings {
  inLanguage: string;
  jobTitle: string;
  alumniOf: string;
  awards: string[];
  catalogName: string;
}

export const SEO: Record<Locale, SeoStrings> = {
  'pt-br': {
    inLanguage: 'pt-BR',
    jobTitle: 'Gestor do Escritório de Processos, Web Developer e Cientista de Dados',
    alumniOf: 'UNICAMP — Universidade Estadual de Campinas',
    awards: [
      '1º Lugar · Santander Bootcamp 2025 Back-End Python (11.434 inscritos)',
      '1º Lugar · Santander Bootcamp 2023 Ciência de Dados (17.600 inscritos)',
      '1º Lugar · Bootcamp Nexa IA Generativa & Claude 3',
    ],
    catalogName: 'Serviços Digitais e de Gestão',
  },
  en: {
    inLanguage: 'en',
    jobTitle: 'Process Office Manager, Web Developer & Data Scientist',
    alumniOf: 'UNICAMP — University of Campinas',
    awards: [
      '1st Place · Santander Bootcamp 2025 Back-End Python (11,434 enrolled)',
      '1st Place · Santander Bootcamp 2023 Data Science (17,600 enrolled)',
      '1st Place · Nexa Bootcamp Generative AI & Claude 3',
    ],
    catalogName: 'Digital & Management Services',
  },
};
