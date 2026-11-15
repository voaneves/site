import type { Locale } from '../i18n/ui';

export interface AwardItem {
  place: string;
  title: string;
  detail: string;
  meta: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface ImpactMetric {
  metric: string;
  label: string;
  source: string;
}

export interface ChartBar {
  label: string;
  value: number;
  unit: string;
  note: string;
}

export interface JourneyItem {
  id: string;
  role: string;
  company: string;
  period: string;
  location: string;
  logo: string;
  logoAlt: string;
  summary: string;
  highlights: string[];
  current?: boolean;
}

export interface ArchiveEntry {
  title: string;
  org: string;
  period: string;
  detail?: string;
}

export interface ProjectCase {
  slug: string;
  index: string;
  title: string;
  client: string;
  year: string;
  category: string;
  metricBadge: string;
  summary: string;
  image: string;
  imageAlt: string;
  tags: string[];
  externalUrl?: string;
  heroMetrics: Array<{ value: string; label: string }>;
  challenge: string;
  architecture: string;
  outcomes: string[];
  deliverables: string[];
}

export interface ServiceItem {
  n: string;
  tag: string;
  title: string;
  price: string;
  unit: string;
  featured?: boolean;
  description: string;
  deliverables: string[];
  waMessage: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface PortfolioContent {
  hero: {
    firstName: string;
    lastName: string;
    kicker: string;
    essence: string;
    sub: string;
    portraitAlt: string;
    portraitCaption: string;
    badgeText: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaCv: string;
    chips: Array<{ label: string; depth: number; pos: 'tl' | 'tr' | 'bl' | 'br' }>;
    bgMarquee: string[];
  };
  about: {
    num: string;
    tag: string;
    statementPre: string;
    statementEm1: string;
    statementMid: string;
    statementEm2: string;
    statementPost: string;
    p1: string;
    p2: string;
    specs: Array<{ k: string; v: string }>;
    awardsTitle: string;
    awards: AwardItem[];
  };
  numbers: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    stats: StatItem[];
    impacts: ImpactMetric[];
    chartTitle: string;
    chartCaption: string;
    chartBars: ChartBar[];
  };
  expertise: {
    num: string;
    tag: string;
    title: string;
    pauseLabel: string;
    resumeLabel: string;
    tracks: [string[], string[], string[]];
    pillars: Array<{ title: string; items: string[] }>;
  };
  journey: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    prevLabel: string;
    nextLabel: string;
    dragHint: string;
    items: JourneyItem[];
    archiveSummary: string;
    educationTitle: string;
    education: ArchiveEntry[];
    certsTitle: string;
    certifications: ArchiveEntry[];
    languagesTitle: string;
    languages: ArchiveEntry[];
  };
  projects: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    viewCaseLabel: string;
    cursorPreviewPrefix: string;
    items: ProjectCase[];
  };
  services: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    items: ServiceItem[];
  };
  faq: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    items: FaqItem[];
  };
  contact: {
    num: string;
    tag: string;
    title: string;
    subtitle: string;
    sla: string;
    koalendarLabel: string;
    koalendarUrl: string;
    whatsappLabel: string;
    whatsappUrl: string;
    emailLabel: string;
    emailAddress: string;
    cvLabel: string;
    cvUrl: string;
    note: string;
  };
  caseUi: {
    breadcrumbHome: string;
    breadcrumbProjects: string;
    clientLabel: string;
    yearLabel: string;
    categoryLabel: string;
    challengeTitle: string;
    architectureTitle: string;
    outcomesTitle: string;
    deliverablesTitle: string;
    liveLinkLabel: string;
    prevProject: string;
    nextProject: string;
    ctaHeading: string;
    ctaButton: string;
  };
}

export const PORTFOLIO: Record<Locale, PortfolioContent> = {
  'pt-br': {
    hero: {
      firstName: 'VICTOR',
      lastName: 'NEVES',
      kicker: 'PALMAS, TO · ENGENHARIA, DADOS, DESIGN & CÓDIGO',
      essence: 'Sinal, não ruído.',
      sub: 'Engenheiro mecânico pela UNICAMP, Gestor do Escritório de Processos no SEBRAE Tocantins e bicampeão em 1º lugar no Santander Bootcamp. Uno BPMN, BI, IA e desenvolvimento web em entregas mensuráveis.',
      portraitAlt: 'Retrato editorial de Victor Neves em alto contraste',
      portraitCaption: 'Passe o mouse para revelar em cor',
      badgeText: 'DISPONÍVEL · NOVOS PROJETOS · PALMAS · BRASIL · ',
      ctaPrimary: 'Agendar conversa',
      ctaSecondary: 'Ver projetos',
      ctaCv: 'Baixar CV (PDF)',
      chips: [
        { label: 'ENGENHEIRO · UNICAMP', depth: 18, pos: 'tl' },
        { label: '1º SANTANDER ×2', depth: -16, pos: 'tr' },
        { label: 'PROCESSOS · SEBRAE', depth: 14, pos: 'bl' },
        { label: 'DATA · IA · WEB', depth: -20, pos: 'br' },
      ],
      bgMarquee: ['DATA SCIENCE', 'DIGITAL TRANSFORMATION', 'POWER BI & QLIK', 'ASTRO & CLOUDFLARE', 'BPMN 2.0'],
    },
    about: {
      num: '01',
      tag: '01 · QUEM SOU',
      statementPre: 'Transformo operações complexas em ',
      statementEm1: 'sistemas legíveis',
      statementMid: ' e produtos digitais com ',
      statementEm2: 'resultado auditável',
      statementPost: '.',
      p1: 'Formado em Engenharia Mecânica pela UNICAMP, com intercâmbio industrial na Krones AG (Alemanha), passagens por Manutenção e Planejamento Estratégico na Coca-Cola FEMSA e duas pós-graduações em IA/BI/Big Data e Análise de Sistemas. Hoje lidero o Escritório de Processos no SEBRAE Tocantins e avalio projetos de IA e Big Data no Projeto Centelha.',
      p2: 'Por meio da voaneves.com, atendo empresas e lideranças que precisam sair de planilhas desconexas e sites lentos para interfaces rápidas, painéis de decisão confiáveis e fluxos digitais enxutos.',
      specs: [
        { k: 'Base & Alcance', v: 'Palmas, TO · Atende Brasil e Global (remoto/híbrido)' },
        { k: 'Formação', v: 'UNICAMP · Pós IA, BI & Big Data · Pós Análise de Sistemas' },
        { k: 'Idiomas', v: 'Português (nativo) · Inglês C2 (EF SET 84/100) · Espanhol · Coreano · Alemão' },
        { k: 'Certificações', v: 'Lean Six Sigma Green Belt · Google PM & Data Analytics · Cambridge ESG' },
      ],
      awardsTitle: 'Conquistas e reconhecimentos verificáveis',
      awards: [
        { place: '1º LUGAR', title: 'Santander Bootcamp 2025', detail: 'Back-End com Python, FastAPI & Docker', meta: 'Entre 11.434 inscritos · DIO' },
        { place: '1º LUGAR', title: 'Santander Bootcamp 2023', detail: 'Ciência de Dados com Python & ML', meta: 'Entre 17.600 inscritos · DIO' },
        { place: '1º LUGAR', title: 'Bootcamp Nexa 2024', detail: 'IA Generativa & Claude 3 / Bedrock', meta: 'Ranking geral nº 1 · DIO' },
        { place: '1º LUGAR', title: 'Santander Bootcamp AWS 2024', detail: 'Arquitetura & Certificação Cloud', meta: 'Ranking geral nº 1 · DIO' },
        { place: '1º LUGAR', title: 'Estratégia em Alto Mar', detail: 'Planejamento Estratégico Nacional', meta: 'SEBRAE Tocantins' },
      ],
    },
    numbers: {
      num: '02',
      tag: '02 · NÚMEROS & IMPACTO',
      title: 'Impacto mensurável, do chão de fábrica ao deploy em borda.',
      subtitle: 'Indicadores extraídos de operações reais no SEBRAE, Coca-Cola FEMSA, Damásio e projetos web em produção.',
      stats: [
        { value: '8+', label: 'anos combinando dados, processos e código' },
        { value: '40+', label: 'projetos entregues entre web, apps e BI' },
        { value: '11', label: 'organizações e ecossistemas atendidos' },
        { value: '5', label: 'idiomas (PT · EN · ES · KO · DE)' },
      ],
      impacts: [
        { metric: '+76%', label: 'produtividade média de MPEs no 1º ciclo', source: 'SEBRAE · Agente Local de Inovação' },
        { metric: '+40', label: 'dashboards interativos entregues em Power BI', source: 'Coca-Cola, SEBRAE, Damásio & MPEs' },
        { metric: '+50', label: 'processos corporativos refinados em BPMN 2.0', source: 'SEBRAE Tocantins · UGE' },
        { metric: '+32%', label: 'cumprimento trimestral de metas estratégicas', source: 'Consultoria de OKRs · voaneves.com' },
        { metric: '+22%', label: 'receita média adicional para clientes', source: 'Brasil Mais · Novos nichos' },
        { metric: '+236%', label: 'alcance orgânico em campanhas digitais', source: 'MTE · UNICAMP / Campinas' },
        { metric: '−4,5%', label: 'paradas não planejadas via projetos DMAIC', source: 'Coca-Cola FEMSA · Jundiaí' },
        { metric: '13+', label: 'oficinas práticas de 4h sobre IA aplicada', source: 'SEBRAE · Capacitação regional' },
      ],
      chartTitle: 'Salto de performance web (Lighthouse)',
      chartCaption: 'Pontuação antes vs. depois em projetos auditados em produção.',
      chartBars: [
        { label: 'CAATO', value: 92, unit: '43 -> 92', note: 'Lighthouse Performance' },
        { label: 'Mota & Godinho', value: 91, unit: '62 -> 91', note: 'Core Web Vitals' },
        { label: 'voaneves v5', value: 100, unit: 'Meta 100', note: 'Astro + Cloudflare Edge' },
      ],
    },
    expertise: {
      num: '03',
      tag: '03 · EXPERTISE & STACK',
      title: 'Da arquitetura de dados à interface final.',
      pauseLabel: 'Pausar letreiro',
      resumeLabel: 'Retomar letreiro',
      tracks: [
        ['DATA SCIENCE', 'BPM & PROCESSOS', 'DESIGN SYSTEMS', 'FULL-STACK WEB', 'TRANSFORMACAO DIGITAL'],
        ['PYTHON · FASTAPI', 'POWER BI · QLIK SENSE', 'ASTRO · TYPESCRIPT', 'REACT · NEXT.JS · FLUTTER', 'SQL · NOSQL · DOCKER'],
        ['AWS · CLOUDFLARE', 'LEAN SIX SIGMA', 'OKRS & ESTRATEGIA', 'IA GENERATIVA & LLMS', 'FIGMA · WCAG 2.2 AA'],
      ],
      pillars: [
        { title: 'Engenharia Web & Design', items: ['Astro', 'TypeScript', 'React', 'Next.js', 'Flutter', 'HTML/CSS', 'Figma', 'Tokens W3C', 'WCAG 2.2 AA', 'SEO Técnico'] },
        { title: 'Dados, BI & IA Aplicada', items: ['Python', 'Power BI', 'Qlik Sense', 'SQL / NoSQL', 'Pandas / NumPy', 'FastAPI', 'LLMs & Prompts', 'ETL & Modelagem'] },
        { title: 'Processos & Estratégia', items: ['BPMN 2.0', 'Lean Six Sigma Green Belt', 'DMAIC', 'OKRs', 'Scrum & Kanban', 'Automações Low-Code'] },
        { title: 'Cloud & Confiabilidade', items: ['Cloudflare Pages & Workers', 'AWS', 'GCP', 'Docker', 'GitHub Actions', 'Lighthouse CI'] },
      ],
    },
    journey: {
      num: '04',
      tag: '04 · JORNADA',
      title: 'Trajetória construída em campo, fábrica e código.',
      subtitle: 'Arraste, use as setas ou navegue pelos cartões para explorar cada ciclo profissional.',
      prevLabel: 'Etapa anterior',
      nextLabel: 'Próxima etapa',
      dragHint: 'Arraste ou clique nas setas',
      items: [
        {
          id: 'sebrae-uge',
          role: 'Gestor do Escritório de Processos',
          company: 'SEBRAE Tocantins',
          period: 'Out 2024 — Atual',
          location: 'Palmas, TO',
          logo: '/assets/img/sebrae.webp',
          logoAlt: 'Logo SEBRAE',
          current: true,
          summary: 'Governança de processos BPMN 2.0, automações e painéis executivos para a Unidade de Gestão Estratégica (UGE).',
          highlights: [
            'Refinou +50 processos corporativos (AS-IS/TO-BE) com versionamento central e redução de gargalos.',
            'Conecta OKRs e indicadores estratégicos a painéis em Qlik Sense para decisão da diretoria.',
          ],
        },
        {
          id: 'voaneves-consult',
          role: 'Consultor & Web Developer',
          company: 'voaneves.com',
          period: 'Nov 2019 — Atual',
          location: 'Brasil & Remoto',
          logo: '/assets/img/freelance.webp',
          logoAlt: 'Identidade voaneves',
          current: true,
          summary: 'Desenvolvimento de sites, apps, design systems e consultoria de BI e transformação digital.',
          highlights: [
            'Entregou +40 dashboards interativos em Power BI automatizando finanças, vendas e operações.',
            'Elevou cumprimento trimestral de metas em +32% e dobrou scores Lighthouse de clientes.',
          ],
        },
        {
          id: 'sebrae-ali',
          role: 'Analista Técnico & ALI',
          company: 'SEBRAE Tocantins',
          period: 'Ago 2022 — Out 2024',
          location: 'Gurupi & Dianópolis, TO',
          logo: '/assets/img/sebrae.webp',
          logoAlt: 'Logo SEBRAE',
          summary: 'Inovação territorial, sprints do programa Brasil Mais e oficinas práticas de Inteligência Artificial.',
          highlights: [
            '+76% de produtividade média nas MPEs acompanhadas no 1º ciclo e +22% de ganho de receita.',
            'Ministrou 13+ oficinas de 4h de IA aplicada para empreendedores e professores.',
          ],
        },
        {
          id: 'damasio',
          role: 'Supervisor de Franquia',
          company: 'Damásio Educacional',
          period: 'Nov 2019 — Mai 2022',
          location: 'Palmas, TO',
          logo: '/assets/img/damasio.webp',
          logoAlt: 'Logo Damásio Educacional',
          summary: 'Transformação digital da unidade com BI comercial, campanhas orientadas a UX e cultura de dados.',
          highlights: [
            'Implementou relatórios em Power BI e treinou 100% da equipe em literacia de dados.',
            'Modelo operacional reconhecido pela matriz nacional da rede.',
          ],
        },
        {
          id: 'coca-trainee',
          role: 'Trainee de Planejamento Estratégico',
          company: 'Coca-Cola FEMSA',
          period: 'Jan 2019 — Out 2019',
          location: 'São Paulo, SP',
          logo: '/assets/img/coca-cola.webp',
          logoAlt: 'Logo Coca-Cola FEMSA',
          summary: 'Consolidação automática de KPIs executivos e storytelling de dados para liderança C-level.',
          highlights: [
            'Modelou bases e fluxos ETL para mais de 20 indicadores corporativos em Power BI.',
            'Traduziu análises complexas em planos de ação rápidos junto à diretoria.',
          ],
        },
        {
          id: 'krones',
          role: 'Summer Intern · Engenharia Industrial',
          company: 'Krones AG',
          period: 'Jul 2018 — Ago 2018',
          location: 'Neutraubling / Regensburg, Alemanha',
          logo: '/assets/img/krones.webp',
          logoAlt: 'Logo Krones AG',
          summary: 'Intercâmbio industrial na matriz alemã em manufatura de linhas de envase e inspeção.',
          highlights: [
            'Integrou frentes de manufatura, qualidade, vendas técnicas e gestão internacional.',
            'Imersão profissional em alemão e inglês no polo industrial bávaro.',
          ],
        },
        {
          id: 'coca-manut',
          role: 'Estagiário de Manutenção & DMAIC',
          company: 'Coca-Cola FEMSA',
          period: 'Jan 2017 — Jan 2019',
          location: 'Jundiaí, SP',
          logo: '/assets/img/coca-cola.webp',
          logoAlt: 'Logo Coca-Cola FEMSA',
          summary: 'Liderança de projetos Six Sigma DMAIC em confiabilidade fabril (RCM), 5S e eficiência energética.',
          highlights: [
            'Reduziu paradas não planejadas em 4,5% e conduziu estudo de corte energético de 2%.',
            'Criou painéis de KPIs de manutenção para gestão à vista no chão de fábrica.',
          ],
        },
        {
          id: 'unicamp-mte',
          role: 'Engenharia Mecânica, MTE & CNPq',
          company: 'UNICAMP · MTE · Labmet',
          period: '2012 — 2018',
          location: 'Campinas, SP',
          logo: '/assets/img/unicamp.webp',
          logoAlt: 'Logo UNICAMP',
          summary: 'Graduação em Engenharia Mecânica (3.600h), iniciação científica CNPq em nanotubos de TiO2 e Diretoria no MTE.',
          highlights: [
            'Reestruturou site e marca do MTE (+236% de alcance) e atuou na Feira Talento.',
            'Pesquisa biomédica apresentada no congresso PIBIC da UNICAMP.',
          ],
        },
      ],
      archiveSummary: 'Ver formação acadêmica, certificações internacionais e idiomas completos',
      educationTitle: 'Formação Acadêmica',
      education: [
        { title: 'Pós-graduação em Análise de Sistemas', org: 'Faculdade Focus', period: 'Dez 2023 — Mai 2024', detail: 'Remoto' },
        { title: 'Pós-graduação em IA, BI e Big Data', org: 'Faculdade Focus', period: 'Jul 2023 — Nov 2023', detail: 'Remoto' },
        { title: 'Engenharia Mecânica (Bacharelado)', org: 'UNICAMP', period: '2012 — 2018', detail: 'Campinas, SP · 3.600h' },
      ],
      certsTitle: 'Certificações de Destaque',
      certifications: [
        { title: 'Skills for the Green Transition (ESG)', org: 'University of Cambridge', period: 'Dez 2023' },
        { title: 'Google Project Management & Data Analytics', org: 'Google / Coursera', period: '2023 — 2024' },
        { title: 'EF SET English Certificate 84/100 (C2 Proficient)', org: 'EF SET', period: 'Abr 2023' },
        { title: 'Lean Six Sigma Green Belt (DMAIC)', org: 'MI Domenech', period: 'Jan 2019' },
        { title: 'Data Visualization & Decision Making', org: 'PwC', period: '2023' },
        { title: 'Avaliador de Projetos (IA & Big Data)', org: 'Projeto Centelha', period: 'Ago 2023 — Atual' },
      ],
      languagesTitle: 'Idiomas',
      languages: [
        { title: 'Português', org: 'Nativo', period: 'PT-BR' },
        { title: 'Inglês', org: 'Fluente · EF SET 84/100', period: 'C2' },
        { title: 'Espanhol', org: 'Avançado', period: 'C1' },
        { title: 'Coreano & Alemão', org: 'Intermediário / Básico', period: 'B1 · A2' },
      ],
    },
    projects: {
      num: '05',
      tag: '05 · PROJETOS & ESTUDOS DE CASO',
      title: 'Seleção de projetos em produção.',
      subtitle: 'Passe o cursor sobre um projeto para pré-visualizar ou abra o estudo de caso completo.',
      viewCaseLabel: 'Abrir estudo',
      cursorPreviewPrefix: 'ABRIR',
      items: [
        {
          slug: 'mte',
          index: '01',
          title: 'MTE · Marca, Plataforma Web & Feira Talento',
          client: 'Mercado de Trabalho em Engenharia (UNICAMP)',
          year: '2014–2018',
          category: 'Marca & Produto Web',
          metricBadge: '+236% alcance',
          summary: 'Reestruturação completa da identidade visual, site responsivo em Drupal/CSS e internalização da Feira Talento.',
          image: '/assets/img/port/mte.webp',
          imageAlt: 'Prévia do portal e identidade visual criados para o MTE',
          tags: ['Identidade Visual', 'Drupal CMS', 'UX Mobile', 'SEO', 'Cloud'],
          externalUrl: 'https://mte.org.br',
          heroMetrics: [
            { value: '+236%', label: 'crescimento de alcance orgânico' },
            { value: '3,5x', label: 'aumento de público médio por evento (15 -> 53)' },
            { value: '2x', label: 'mais eventos realizados por ciclo' },
          ],
          challenge: 'A organização estudantil ligada à Engenharia da UNICAMP dependia de uma presença web desatualizada, com baixa aderência mobile e processos manuais para eventos corporativos.',
          architecture: 'Conduzi o redesign da marca, reformulei templates CSS e formulários no Drupal com foco mobile-first e SEO, adotei infraestrutura em nuvem e apoiei o design da Feira Talento.',
          outcomes: [
            'Alcance digital ampliado em +236% após novo posicionamento visual e editorial.',
            'Média de participantes por workshop subiu de 15 para 53 estudantes.',
            'Portal unificado de inscrição para empresas parceiras na maior feira universitária da América Latina.',
          ],
          deliverables: ['Sistema de identidade visual', 'Site responsivo mobile-first', 'Formulários e fluxos de eventos', 'Plano editorial e SEO'],
        },
        {
          slug: 'dashboards',
          index: '02',
          title: 'Ecossistema de Dashboards & BI Executivo',
          client: 'Coca-Cola FEMSA · SEBRAE · Damásio · MPEs',
          year: '2018–Atual',
          category: 'Data Visualization & BI',
          metricBadge: '+40 painéis',
          summary: 'Modelagem ETL, governança de KPIs e mais de 40 dashboards em Power BI e Qlik Sense orientados à decisão.',
          image: '/assets/img/port/dash.webp',
          imageAlt: 'Interface de dashboards analíticos em Power BI e Qlik Sense',
          tags: ['Power BI', 'Qlik Sense', 'ETL', 'SQL', 'OKRs'],
          heroMetrics: [
            { value: '+40', label: 'dashboards interativos publicados' },
            { value: '+32%', label: 'melhora no cumprimento trimestral de metas' },
            { value: '100%', label: 'eliminação de relatórios manuais recorrentes' },
          ],
          challenge: 'Equipes comerciais, industriais e estratégicas gastavam dezenas de horas consolidando planilhas diferentes com números conflitantes antes de cada reunião de diretoria.',
          architecture: 'Partindo do mapeamento de decisões críticas e BPMN, estruturei pipelines de tratamento de dados (Excel, SQL e Python), modelo estrela padronizado e painéis com hierarquia visual clara.',
          outcomes: [
            'Visão única de vendas, finanças, manutenção industrial (OEE/downtime) e metas OKR.',
            'Treinamento direto dos times operacionais e executivos C-level para autonomia analítica.',
            'Redução drástica do tempo entre ocorrência operacional e tomada de decisão.',
          ],
          deliverables: ['Modelagem de dados & ETL', 'Design system analítico', 'Painéis Power BI / Qlik Sense', 'Capacitação dos times'],
        },
        {
          slug: 'caato',
          index: '03',
          title: 'CAATO · Auditoria Técnica, SEO & Velocidade',
          client: 'CAATO',
          year: '2022',
          category: 'Performance & SEO',
          metricBadge: '43 -> 92 Lighthouse',
          summary: 'Refatoração de WordPress, correção de spam e redirecionamentos, levando a nota Lighthouse de 43 para 92.',
          image: '/assets/img/port/caato.webp',
          imageAlt: 'Tela do projeto web CAATO após otimização de performance',
          tags: ['Performance', 'SEO Técnico', 'WordPress', 'Segurança'],
          externalUrl: 'https://caato.com.br',
          heroMetrics: [
            { value: '43 -> 92', label: 'salto de pontuação no Google Lighthouse' },
            { value: '0', label: 'falhas de redirecionamento após limpeza de URLs' },
            { value: '100%', label: 'saneamento de segurança de tema e formulários' },
          ],
          challenge: 'Site institucional penalizado por carregamento lento, plugins obsoletos, URLs longas e vulnerabilidade a spam nas caixas de contato.',
          architecture: 'Atualização controlada de core, tema e plugins, racionalização de scripts de terceiros, estratégia de cache/ativos, mapa de redirects 301 e proteção anti-spam em formulários.',
          outcomes: [
            'Score de performance saltou +49 pontos no Lighthouse sem troca traumática de CMS.',
            'Melhoria imediata em indexação orgânica e legibilidade em dispositivos móveis.',
            'Eliminação de ruído operacional nas caixas de e-mail da equipe.',
          ],
          deliverables: ['Auditoria Core Web Vitals', 'Upgrade seguro & anti-spam', 'Mapa de redirecionamentos 301', 'Documentação de manutenção'],
        },
        {
          slug: 'mota-godinho',
          index: '04',
          title: 'Mota & Godinho · Otimização UX & Mobile',
          client: 'Mota & Godinho',
          year: '2022',
          category: 'UX & Core Web Vitals',
          metricBadge: '62 -> 91 Lighthouse',
          summary: 'Evolução de navegação mobile, header/footer e ativos estáticos elevando Lighthouse de 62 para 91.',
          image: '/assets/img/port/mota.webp',
          imageAlt: 'Captura do projeto Mota & Godinho com foco em UX e mobile',
          tags: ['UX/UI', 'Mobile-First', 'Performance', 'SEO'],
          externalUrl: 'https://motagodinho.com.br',
          heroMetrics: [
            { value: '62 -> 91', label: 'ganho de performance no Lighthouse' },
            { value: '+Engajamento', label: 'fluxo simplificado no cabeçalho e rodapé' },
            { value: 'Mobile', label: 'layout ajustado para leitura em telas pequenas' },
          ],
          challenge: 'Layout com gargalos de renderização, excesso de peso em páginas de entrada e fricção na navegação móvel para encontrar serviços e contato.',
          architecture: 'Reestruturação de hierarquia de cabeçalho e rodapé, otimização de carregamento crítico, atualização de stack e refino visual focado em clareza de conversão.',
          outcomes: [
            'Carregamento substancialmente mais ágil em conexões móveis 4G.',
            'Navegação mais direta até os pontos de contato e conversão.',
          ],
          deliverables: ['Redesign de header/footer', 'Otimização de carregamento', 'Ajuste responsivo', 'Ajustes on-page de SEO'],
        },
        {
          slug: 'boas-obras',
          index: '05',
          title: 'Boas Obras · Identidade & Portal Estático Zero-Custo',
          client: 'ONG Boas Obras (Campinas/SP)',
          year: '2015–2022',
          category: 'Identidade & Static Web',
          metricBadge: 'Zero custo servidor',
          summary: 'Criação do zero da identidade visual e portal estático de alta disponibilidade para organização social.',
          image: '/assets/img/port/boas.webp',
          imageAlt: 'Visual do portal institucional da ONG Boas Obras',
          tags: ['Branding', 'Jekyll / Hugo', 'GitHub Pages', 'Terceiro Setor'],
          externalUrl: 'https://boasobras.org',
          heroMetrics: [
            { value: 'R$ 0', label: 'custo mensal de hospedagem estática' },
            { value: '0 -> 1', label: 'identidade e presença digital completas' },
            { value: '7 anos', label: 'evolução contínua e manutenção' },
          ],
          challenge: 'ONG dedicada ao apoio de idosos, crianças e pessoas em situação de rua precisava captar voluntários e doações sem orçamento para servidores pagos.',
          architecture: 'Desenvolvi a marca completa e construí o site estático com Jekyll/Hugo no GitHub Pages, com foco total em leitura móvel e zero manutenção de banco de dados.',
          outcomes: [
            'Presença institucional profissional operando continuamente sem custo de infraestrutura.',
            'Comunicação clara das ações sociais para atrair voluntários e doadores.',
          ],
          deliverables: ['Identidade visual', 'Site estático otimizado', 'Conteúdo e arquitetura mobile', 'Hospedagem estática confiável'],
        },
        {
          slug: 'midflow',
          index: '06',
          title: 'MIDFLOW · Estúdio Criativo com IA para PMEs',
          client: 'Produto Próprio · voaneves',
          year: '2026',
          category: 'Produto SaaS & Edge',
          metricBadge: 'React 19 + Edge',
          summary: 'Plataforma web que transforma briefings guiados de PMEs em posts de feed e sequências de Stories em Canvas.',
          image: '/assets/img/port/app.webp',
          imageAlt: 'Interface de produto web e aplicativo mobile do ecossistema voaneves',
          tags: ['React 19', 'TypeScript', 'Cloudflare Workers', 'Gemini AI', 'PWA'],
          heroMetrics: [
            { value: '1080px', label: 'renderizador Canvas nativo para feed e Stories' },
            { value: 'Edge', label: 'API Worker com rate limiting e Durable Objects' },
            { value: 'PWA', label: 'edição offline-ready com exportação PNG/ZIP' },
          ],
          challenge: 'Pequenos negócios brasileiros perdem horas tentando criar peças consistentes para redes sociais sem dominar ferramentas pesadas de design.',
          architecture: 'Frontend React 19 + Zustand com renderizador próprio em Canvas 1080px, PWA instalável e backend distribuído em Cloudflare Workers/Pages + Gemini AI com engine de fallback.',
          outcomes: [
            'Briefing curto gera carrosséis de Stories e posts prontos com paleta, fotografia e legenda.',
            'Arquitetura enxuta preparada para operação comercial em borda com custo previsível.',
          ],
          deliverables: ['Design de produto & Canvas UI', 'Frontend PWA React 19', 'Worker API no Cloudflare Edge', 'Suíte E2E e orçamento de bundle'],
        },
      ],
    },
    services: {
      num: '06',
      tag: '06 · SERVIÇOS',
      title: 'Escopo claro, preço transparente e contato direto.',
      subtitle: 'Do primeiro diagnóstico à entrega em produção — você conversa e decide direto com quem projeta e implementa.',
      ctaLabel: 'Solicitar proposta',
      items: [
        {
          n: '01',
          tag: 'WEB DE ALTA PERFORMANCE',
          title: 'Criação de Website',
          price: 'R$ 800',
          unit: 'a partir de',
          featured: true,
          description: 'Site rápido, memorável e pensado para conversão real — com design editorial, SEO técnico, acessibilidade e publicação em borda.',
          deliverables: ['Design sob medida', 'Core Web Vitals no verde', 'SEO & Schema', 'Responsivo mobile-first'],
          waMessage: 'Olá Victor! Gostaria de conversar sobre a criação de um website.',
        },
        {
          n: '02',
          tag: 'APLICATIVOS & MVPS',
          title: 'Criação de Apps',
          price: 'R$ 1.500',
          unit: 'a partir de',
          featured: true,
          description: 'Experiência mobile e web fluida (React Native, Flutter ou PWA) que foge do design genérico e entrega fluxo ágil ao usuário.',
          deliverables: ['Protótipo navegável Figma', 'Android / iOS / PWA', 'Integrações de API', 'Foco em UX'],
          waMessage: 'Olá Victor! Gostaria de conversar sobre a criação de um aplicativo.',
        },
        {
          n: '03',
          tag: 'OPERAÇÃO & ESTRATÉGIA',
          title: 'Transformação Digital',
          price: 'R$ 1.200',
          unit: 'a partir de',
          featured: true,
          description: 'Diagnóstico ponta a ponta para modernizar processos (BPMN 2.0), unificar canais digitais e eliminar retrabalho manual.',
          deliverables: ['Mapeamento AS-IS / TO-BE', 'Automações low-code', 'Cultura de dados', 'Roadmap executivo'],
          waMessage: 'Olá Victor! Quero estruturar a Transformação Digital da minha empresa.',
        },
        {
          n: '04',
          tag: 'BUSINESS INTELLIGENCE',
          title: 'Dashboards & BI',
          price: 'R$ 200',
          unit: 'a partir de',
          description: 'Tratamento de dados e painéis interativos em Power BI ou Qlik Sense para decisões mais rápidas e confiáveis.',
          deliverables: ['ETL & limpeza de base', 'Power BI / Qlik Sense', 'KPIs acionáveis'],
          waMessage: 'Olá Victor! Preciso de dashboards em BI para acompanhar meus indicadores.',
        },
        {
          n: '05',
          tag: 'METODOLOGIA SEBRAE',
          title: 'Produtividade em 9 Etapas',
          price: 'R$ 800',
          unit: 'a partir de',
          description: 'Sprints estruturadas para cortar desperdícios, organizar rotina operacional e aumentar faturamento de MPEs.',
          deliverables: ['Sprint 9 etapas', 'Redução de custos', 'Plano de ação imediato'],
          waMessage: 'Olá Victor! Quero aplicar as sprints de Produtividade no meu negócio.',
        },
        {
          n: '06',
          tag: 'EVOLUÇÃO CONTÍNUA',
          title: 'Manutenção de Site',
          price: 'R$ 100',
          unit: 'a partir de',
          description: 'Velocidade, atualizações de segurança, melhorias de SEO e treinamento prático para a sua própria equipe.',
          deliverables: ['Hardening & backups', 'Otimização Lighthouse', 'Suporte ágil'],
          waMessage: 'Olá Victor! Preciso de manutenção e melhoria de performance no meu site.',
        },
        {
          n: '07',
          tag: 'ADVISORY 1:1',
          title: 'Consultoria de Gestão',
          price: 'R$ 90',
          unit: '/ hora',
          description: 'Sessões práticas combinando analytics, Six Sigma e experiência de gestão para destravar gargalos e OKRs.',
          deliverables: ['Diagnóstico de OKRs', 'Priorização executiva'],
          waMessage: 'Olá Victor! Gostaria de agendar uma Consultoria de Gestão.',
        },
        {
          n: '08',
          tag: 'TECNOLOGIA & IA',
          title: 'Consultoria Digital & IA',
          price: 'R$ 90',
          unit: '/ hora',
          description: 'Integração de sistemas, automações com IA generativa, arquitetura web e capacitação in-company ou palestras.',
          deliverables: ['Arquitetura & ferramentas', 'Oficinas de IA aplicada'],
          waMessage: 'Olá Victor! Quero agendar uma Consultoria Digital / oficina de IA.',
        },
      ],
    },
    faq: {
      num: '07',
      tag: '07 · PERGUNTAS FREQUENTES',
      title: 'Dúvidas comuns antes de começar.',
      subtitle: 'Respostas diretas sobre prazos, forma de trabalho e investimento.',
      items: [
        {
          q: 'Qual é o prazo médio para entrega de um site ou dashboard?',
          a: 'Dashboards enxutos em Power BI costumam ficar prontos em 5 a 10 dias úteis após acesso às bases. Sites institucionais completos levam de 2 a 4 semanas, com prévia navegável publicada desde a primeira semana para validação contínua.',
        },
        {
          q: 'Você atende empresas fora de Palmas ou do Tocantins?',
          a: 'Sim. Atendo clientes presencialmente em Palmas e região, e de forma remota em todo o Brasil e no exterior (em Português, Inglês ou Espanhol), com rituais curtos por vídeo e comunicação ágil via WhatsApp.',
        },
        {
          q: 'Como funciona o pagamento e o início do projeto?',
          a: 'Após uma conversa inicial gratuita de diagnóstico (15 a 30 min), envio proposta com escopo fechado, cronograma e entregáveis. Projetos por escopo costumam ser divididos em 50% na aprovação e 50% na entrega em produção.',
        },
        {
          q: 'O que preciso ter em mãos antes da nossa primeira reunião?',
          a: 'Apenas clareza do objetivo ou do problema que quer resolver — seja aumentar conversões, acelerar um site lento, automatizar planilhas ou organizar processos. Eu conduzo o diagnóstico técnico e ajudo a estruturar o briefing.',
        },
      ],
    },
    contact: {
      num: '08',
      tag: '08 · CONTATO',
      title: 'Vamos tirar seu próximo projeto do papel.',
      subtitle: 'Sem formulário burocrático: agende 20 minutos direto na agenda, mande um WhatsApp ou envie um e-mail.',
      sla: 'Resposta média ~24h (dias úteis)',
      koalendarLabel: 'Agendar reunião (Koalendar)',
      koalendarUrl: 'https://koalendar.com/e/reuniao-com-victor-neves',
      whatsappLabel: 'Chamar no WhatsApp',
      whatsappUrl: 'https://wa.me/5563999999337?text=Ol%C3%A1%20Victor%2C%20vim%20pelo%20voaneves.com%20e%20gostaria%20de%20conversar%20sobre%20um%20projeto.',
      emailLabel: 'victorneves478@gmail.com',
      emailAddress: 'victorneves478@gmail.com',
      cvLabel: 'Currículo em PDF',
      cvUrl: '/assets/cv-pt.pdf',
      note: 'Palmas, Tocantins · Disponível para projetos selecionados e parcerias estratégicas.',
    },
    caseUi: {
      breadcrumbHome: 'Início',
      breadcrumbProjects: 'Projetos',
      clientLabel: 'Cliente / Contexto',
      yearLabel: 'Período',
      categoryLabel: 'Disciplina',
      challengeTitle: '01 · O Desafio',
      architectureTitle: '02 · Estratégia & Arquitetura',
      outcomesTitle: '03 · Resultados Verificados',
      deliverablesTitle: 'Entregáveis',
      liveLinkLabel: 'Visitar projeto externo',
      prevProject: 'Projeto anterior',
      nextProject: 'Próximo projeto',
      ctaHeading: 'Tem um desafio parecido em andamento?',
      ctaButton: 'Agendar conversa agora',
    },
  },
  en: {
    hero: {
      firstName: 'VICTOR',
      lastName: 'NEVES',
      kicker: 'PALMAS, BR · ENGINEERING, DATA, DESIGN & CODE',
      essence: 'Signal, not noise.',
      sub: 'UNICAMP Mechanical Engineer, Process Office Manager at SEBRAE Tocantins, and 2x #1 Santander Bootcamp winner. I combine BPMN, BI, AI, and web engineering into measurable production outcomes.',
      portraitAlt: 'High-contrast editorial portrait of Victor Neves',
      portraitCaption: 'Hover to reveal full color',
      badgeText: 'AVAILABLE · SELECT PROJECTS · BRAZIL · GLOBAL · ',
      ctaPrimary: 'Book a call',
      ctaSecondary: 'Explore work',
      ctaCv: 'Download CV (PDF)',
      chips: [
        { label: 'ENGINEER · UNICAMP', depth: 18, pos: 'tl' },
        { label: '#1 SANTANDER ×2', depth: -16, pos: 'tr' },
        { label: 'PROCESSES · SEBRAE', depth: 14, pos: 'bl' },
        { label: 'DATA · AI · WEB', depth: -20, pos: 'br' },
      ],
      bgMarquee: ['DATA SCIENCE', 'DIGITAL TRANSFORMATION', 'POWER BI & QLIK', 'ASTRO & CLOUDFLARE', 'BPMN 2.0'],
    },
    about: {
      num: '01',
      tag: '01 · ABOUT ME',
      statementPre: 'I turn complex operations into ',
      statementEm1: 'legible systems',
      statementMid: ' and digital products with ',
      statementEm2: 'auditable impact',
      statementPost: '.',
      p1: 'Trained in Mechanical Engineering at UNICAMP with industrial experience at Krones AG (Germany), Maintenance & Strategic Planning at Coca-Cola FEMSA, and dual postgraduate degrees in AI/BI/Big Data and Systems Analysis. Today I lead the Process Management Office at SEBRAE Tocantins and evaluate AI & Big Data grants at Projeto Centelha.',
      p2: 'Through voaneves.com, I partner with businesses and leaders who need to move from disconnected spreadsheets and sluggish sites to crisp interfaces, trustworthy executive BI, and lean digital workflows.',
      specs: [
        { k: 'Base & Reach', v: 'Palmas, Brazil · Serving Brazil & Worldwide remotely' },
        { k: 'Education', v: 'UNICAMP · Postgrad AI, BI & Big Data · Postgrad Systems Analysis' },
        { k: 'Languages', v: 'Portuguese (native) · English C2 (EF SET 84/100) · Spanish · Korean · German' },
        { k: 'Credentials', v: 'Lean Six Sigma Green Belt · Google PM & Data Analytics · Cambridge ESG' },
      ],
      awardsTitle: 'Verified awards & competitive milestones',
      awards: [
        { place: '1ST PLACE', title: 'Santander Bootcamp 2025', detail: 'Back-End with Python, FastAPI & Docker', meta: 'Out of 11,434 participants · DIO' },
        { place: '1ST PLACE', title: 'Santander Bootcamp 2023', detail: 'Data Science with Python & ML', meta: 'Out of 17,600 participants · DIO' },
        { place: '1ST PLACE', title: 'Bootcamp Nexa 2024', detail: 'Generative AI & Claude 3 / Bedrock', meta: 'Ranked #1 overall · DIO' },
        { place: '1ST PLACE', title: 'Santander AWS Bootcamp 2024', detail: 'Cloud Architecture & AWS Prep', meta: 'Ranked #1 overall · DIO' },
        { place: '1ST PLACE', title: 'Estratégia em Alto Mar', detail: 'Strategic Planning Competition', meta: 'SEBRAE Tocantins' },
      ],
    },
    numbers: {
      num: '02',
      tag: '02 · NUMBERS & IMPACT',
      title: 'Measurable impact, from factory floors to Cloudflare Edge.',
      subtitle: 'Metrics grounded in production work at SEBRAE, Coca-Cola FEMSA, Damásio, and independent web engagements.',
      stats: [
        { value: '8+', label: 'years bridging data, processes & code' },
        { value: '40+', label: 'projects shipped across web, apps & BI' },
        { value: '11', label: 'organizations & ecosystems served' },
        { value: '5', label: 'languages (PT · EN · ES · KO · DE)' },
      ],
      impacts: [
        { metric: '+76%', label: 'average SMB productivity uplift in cycle 1', source: 'SEBRAE · Innovation Agent' },
        { metric: '+40', label: 'interactive Power BI dashboards delivered', source: 'Coca-Cola, SEBRAE, Damásio & SMBs' },
        { metric: '+50', label: 'corporate processes refined in BPMN 2.0', source: 'SEBRAE Tocantins · UGE' },
        { metric: '+32%', label: 'quarterly goal completion uplift', source: 'OKR Advisory · voaneves.com' },
        { metric: '+22%', label: 'average client revenue growth unlocked', source: 'Brasil Mais · Market niches' },
        { metric: '+236%', label: 'organic campaign reach expansion', source: 'MTE · UNICAMP / Campinas' },
        { metric: '−4.5%', label: 'unplanned downtime reduced via DMAIC', source: 'Coca-Cola FEMSA · Jundiaí' },
        { metric: '13+', label: 'hands-on 4h Applied AI workshops taught', source: 'SEBRAE · Regional enablement' },
      ],
      chartTitle: 'Verified Web Performance Gains (Lighthouse)',
      chartCaption: 'Before-vs-after production scores audited on live client domains.',
      chartBars: [
        { label: 'CAATO', value: 92, unit: '43 -> 92', note: 'Lighthouse Performance' },
        { label: 'Mota & Godinho', value: 91, unit: '62 -> 91', note: 'Core Web Vitals' },
        { label: 'voaneves v5', value: 100, unit: 'Target 100', note: 'Astro + Cloudflare Edge' },
      ],
    },
    expertise: {
      num: '03',
      tag: '03 · EXPERTISE & STACK',
      title: 'From data pipelines to final interface craft.',
      pauseLabel: 'Pause marquee',
      resumeLabel: 'Resume marquee',
      tracks: [
        ['DATA SCIENCE', 'BPM & PROCESSES', 'DESIGN SYSTEMS', 'FULL-STACK WEB', 'DIGITAL TRANSFORMATION'],
        ['PYTHON · FASTAPI', 'POWER BI · QLIK SENSE', 'ASTRO · TYPESCRIPT', 'REACT · NEXT.JS · FLUTTER', 'SQL · NOSQL · DOCKER'],
        ['AWS · CLOUDFLARE', 'LEAN SIX SIGMA', 'OKRS & STRATEGY', 'GENERATIVE AI & LLMS', 'FIGMA · WCAG 2.2 AA'],
      ],
      pillars: [
        { title: 'Web Engineering & Design', items: ['Astro', 'TypeScript', 'React', 'Next.js', 'Flutter', 'HTML/CSS', 'Figma', 'W3C Tokens', 'WCAG 2.2 AA', 'Technical SEO'] },
        { title: 'Data, BI & Applied AI', items: ['Python', 'Power BI', 'Qlik Sense', 'SQL / NoSQL', 'Pandas / NumPy', 'FastAPI', 'LLMs & Prompting', 'ETL Modeling'] },
        { title: 'Processes & Strategy', items: ['BPMN 2.0', 'Lean Six Sigma Green Belt', 'DMAIC', 'OKRs', 'Scrum & Kanban', 'Low-Code Automation'] },
        { title: 'Cloud & Reliability', items: ['Cloudflare Pages & Workers', 'AWS', 'GCP', 'Docker', 'GitHub Actions', 'Lighthouse CI'] },
      ],
    },
    journey: {
      num: '04',
      tag: '04 · JOURNEY',
      title: 'Built across factory floors, strategy rooms, and code.',
      subtitle: 'Drag horizontally or use the arrow controls to inspect each career chapter.',
      prevLabel: 'Previous role',
      nextLabel: 'Next role',
      dragHint: 'Drag or use arrow controls',
      items: [
        {
          id: 'sebrae-uge',
          role: 'Process Office Manager',
          company: 'SEBRAE Tocantins',
          period: 'Oct 2024 — Present',
          location: 'Palmas, Brazil',
          logo: '/assets/img/sebrae.webp',
          logoAlt: 'SEBRAE logo',
          current: true,
          summary: 'Enterprise BPMN 2.0 governance, process automation, and executive Qlik Sense BI for the Strategic Management Unit.',
          highlights: [
            'Refined 50+ corporate workflows (AS-IS/TO-BE) with centralized versioning and bottleneck removal.',
            'Aligned strategic OKRs directly to executive dashboards and compliance routines.',
          ],
        },
        {
          id: 'voaneves-consult',
          role: 'Management Consultant & Web Dev',
          company: 'voaneves.com',
          period: 'Nov 2019 — Present',
          location: 'Brazil & Remote',
          logo: '/assets/img/freelance.webp',
          logoAlt: 'voaneves brand mark',
          current: true,
          summary: 'Custom websites, mobile/web apps, design systems, and Power BI digital transformation consulting.',
          highlights: [
            'Shipped 40+ interactive Power BI dashboards automating sales, ops, and financial reporting.',
            'Boosted client quarterly goal completion by +32% and doubled web Lighthouse performance scores.',
          ],
        },
        {
          id: 'sebrae-ali',
          role: 'Technical Analyst & Innovation Agent',
          company: 'SEBRAE Tocantins',
          period: 'Aug 2022 — Oct 2024',
          location: 'Gurupi & Dianópolis, Brazil',
          logo: '/assets/img/sebrae.webp',
          logoAlt: 'SEBRAE logo',
          summary: 'Regional entrepreneurship innovation, Brasil Mais agile sprints, and applied AI workshops.',
          highlights: [
            'Delivered +76% average SMB productivity uplift in cycle 1 and +22% revenue growth.',
            'Taught 13+ hands-on 4h Applied AI workshops for local businesses and educators.',
          ],
        },
        {
          id: 'damasio',
          role: 'Franchise Supervisor',
          company: 'Damásio Educacional',
          period: 'Nov 2019 — May 2022',
          location: 'Palmas, Brazil',
          logo: '/assets/img/damasio.webp',
          logoAlt: 'Damásio Educacional logo',
          summary: 'Led branch digital transformation with Power BI reporting, UX marketing, and team data literacy.',
          highlights: [
            'Trained 100% of staff on data-driven routines and executive BI tracking.',
            'Management model recognized nationally by franchise headquarters.',
          ],
        },
        {
          id: 'coca-trainee',
          role: 'Strategic Planning Trainee',
          company: 'Coca-Cola FEMSA',
          period: 'Jan 2019 — Oct 2019',
          location: 'São Paulo, Brazil',
          logo: '/assets/img/coca-cola.webp',
          logoAlt: 'Coca-Cola FEMSA logo',
          summary: 'Automated corporate KPI consolidation in Power BI and C-level executive analytics storytelling.',
          highlights: [
            'Built ETL models feeding 20+ enterprise KPIs with zero manual rework.',
            'Partnered closely with executives to turn analysis into actionable playbooks.',
          ],
        },
        {
          id: 'krones',
          role: 'Summer Intern · Industrial Manufacturing',
          company: 'Krones AG',
          period: 'Jul 2018 — Aug 2018',
          location: 'Neutraubling / Regensburg, Germany',
          logo: '/assets/img/krones.webp',
          logoAlt: 'Krones AG logo',
          summary: 'International industrial exchange building bottling, inspection, and labeling machinery.',
          highlights: [
            'Collaborated across manufacturing, quality assurance, sales engineering, and management.',
            'Strengthened German & English fluency inside a world-leading Bavarian factory.',
          ],
        },
        {
          id: 'coca-manut',
          role: 'Maintenance Engineering Intern (DMAIC)',
          company: 'Coca-Cola FEMSA',
          period: 'Jan 2017 — Jan 2019',
          location: 'Jundiaí, Brazil',
          logo: '/assets/img/coca-cola.webp',
          logoAlt: 'Coca-Cola FEMSA logo',
          summary: 'Led Six Sigma DMAIC reliability initiatives (RCM), 5S, and energy efficiency studies.',
          highlights: [
            'Cut unplanned manufacturing downtime by 4.5% and identified 2% energy savings.',
            'Built maintenance KPI dashboards for shop-floor visual management.',
          ],
        },
        {
          id: 'unicamp-mte',
          role: 'Mechanical Engineering, MTE & CNPq',
          company: 'UNICAMP · MTE · Labmet',
          period: '2012 — 2018',
          location: 'Campinas, Brazil',
          logo: '/assets/img/unicamp.webp',
          logoAlt: 'UNICAMP logo',
          summary: 'B.Sc. Mechanical Engineering (3,600h), CNPq biomedical nanomaterials research, and MTE Marketing Director.',
          highlights: [
            'Rebuilt MTE brand & web presence (+236% reach) and supported Feira Talento.',
            'Presented TiO2 biomedical nanotubes research at UNICAMP PIBIC congress.',
          ],
        },
      ],
      archiveSummary: 'View full education, international certifications & languages',
      educationTitle: 'Education',
      education: [
        { title: 'Postgraduate Diploma in Systems Analysis', org: 'Faculdade Focus', period: 'Dec 2023 — May 2024', detail: 'Remote' },
        { title: 'Postgraduate Diploma in AI, BI & Big Data', org: 'Faculdade Focus', period: 'Jul 2023 — Nov 2023', detail: 'Remote' },
        { title: 'B.Sc. Mechanical Engineering', org: 'UNICAMP', period: '2012 — 2018', detail: 'Campinas, SP · 3,600h' },
      ],
      certsTitle: 'Selected Certifications',
      certifications: [
        { title: 'Skills for the Green Transition (ESG)', org: 'University of Cambridge', period: 'Dec 2023' },
        { title: 'Google Project Management & Data Analytics', org: 'Google / Coursera', period: '2023 — 2024' },
        { title: 'EF SET English Certificate 84/100 (C2 Proficient)', org: 'EF SET', period: 'Apr 2023' },
        { title: 'Lean Six Sigma Green Belt (DMAIC)', org: 'MI Domenech', period: 'Jan 2019' },
        { title: 'Data Visualization & Decision Making', org: 'PwC', period: '2023' },
        { title: 'Innovation Grant Evaluator (AI & Big Data)', org: 'Projeto Centelha', period: 'Aug 2023 — Present' },
      ],
      languagesTitle: 'Languages',
      languages: [
        { title: 'Portuguese', org: 'Native', period: 'PT-BR' },
        { title: 'English', org: 'Fluent · EF SET 84/100', period: 'C2' },
        { title: 'Spanish', org: 'Advanced', period: 'C1' },
        { title: 'Korean & German', org: 'Intermediate / Basic', period: 'B1 · A2' },
      ],
    },
    projects: {
      num: '05',
      tag: '05 · SELECTED WORK & CASE STUDIES',
      title: 'Production work with measurable outcomes.',
      subtitle: 'Hover any project row for a visual preview or open the complete case study.',
      viewCaseLabel: 'Read case',
      cursorPreviewPrefix: 'VIEW',
      items: [
        {
          slug: 'mte',
          index: '01',
          title: 'MTE · Brand Overhaul, Web Platform & Feira Talento',
          client: 'Mercado de Trabalho em Engenharia (UNICAMP)',
          year: '2014–2018',
          category: 'Brand & Web Product',
          metricBadge: '+236% reach',
          summary: 'Complete visual identity redesign, mobile Drupal platform overhaul, and Feira Talento design contribution.',
          image: '/assets/img/port/mte.webp',
          imageAlt: 'Preview of the MTE web platform and visual identity',
          tags: ['Brand Identity', 'Drupal CMS', 'Mobile UX', 'SEO', 'Cloud'],
          externalUrl: 'https://mte.org.br',
          heroMetrics: [
            { value: '+236%', label: 'organic digital reach growth' },
            { value: '3.5x', label: 'event attendance growth (15 -> 53 avg)' },
            { value: '2x', label: 'more events delivered per cycle' },
          ],
          challenge: 'A flagship engineering career organization at UNICAMP relied on a dated desktop-only site and fragmented registration workflows.',
          architecture: 'Redesigned brand identity, refactored CSS & Drupal templates for mobile-first UX and SEO, adopted cloud tooling, and co-designed Feira Talento digital assets.',
          outcomes: [
            'Expanded digital reach by +236% through unified brand & content cadence.',
            'Grew average event attendance from 15 to 53 participants while doubling event frequency.',
            'Streamlined corporate recruiting workflows for Latin America’s largest university career fair.',
          ],
          deliverables: ['Visual identity system', 'Mobile-first responsive website', 'Event registration flows', 'SEO & editorial strategy'],
        },
        {
          slug: 'dashboards',
          index: '02',
          title: 'Executive BI & Dashboard Ecosystem',
          client: 'Coca-Cola FEMSA · SEBRAE · Damásio · SMBs',
          year: '2018–Present',
          category: 'Data Visualization & BI',
          metricBadge: '40+ dashboards',
          summary: 'End-to-end ETL modeling, KPI governance, and 40+ interactive Power BI & Qlik Sense decision panels.',
          image: '/assets/img/port/dash.webp',
          imageAlt: 'Analytical BI dashboards designed in Power BI and Qlik Sense',
          tags: ['Power BI', 'Qlik Sense', 'ETL', 'SQL', 'OKRs'],
          heroMetrics: [
            { value: '40+', label: 'interactive BI dashboards shipped' },
            { value: '+32%', label: 'quarterly goal achievement uplift' },
            { value: '100%', label: 'elimination of recurring manual spreadsheets' },
          ],
          challenge: 'Operational and executive teams spent days reconciling conflicting spreadsheets before strategy reviews.',
          architecture: 'Mapped core business decisions and BPMN workflows first, then engineered clean ETL pipelines (Excel, SQL, Python), star schemas, and high-signal visual layouts.',
          outcomes: [
            'Single source of truth across commercial pipelines, plant downtime KPIs, and strategic OKRs.',
            'Direct enablement workshops empowering executives and frontline staff alike.',
            'Sharply shorter lag between an operational event and the decision it calls for.',
          ],
          deliverables: ['Data modeling & ETL', 'Analytical UI design system', 'Power BI / Qlik Sense suite', 'Team enablement'],
        },
        {
          slug: 'caato',
          index: '03',
          title: 'CAATO · Speed, Technical SEO & Security Overhaul',
          client: 'CAATO',
          year: '2022',
          category: 'Web Performance & SEO',
          metricBadge: '43 -> 92 Lighthouse',
          summary: 'WordPress core upgrade, anti-spam hardening, URL cleanup and caching lifting Lighthouse from 43 to 92.',
          image: '/assets/img/port/caato.webp',
          imageAlt: 'CAATO institutional website after speed and SEO overhaul',
          tags: ['Performance', 'Technical SEO', 'WordPress', 'Security'],
          externalUrl: 'https://caato.com.br',
          heroMetrics: [
            { value: '43 -> 92', label: 'Google Lighthouse score jump' },
            { value: '0', label: 'broken URLs after 301 redirect audit' },
            { value: '100%', label: 'contact inbox spam mitigation' },
          ],
          challenge: 'Institutional website penalized by slow load times, outdated plugins, bloated URLs, and heavy form spam.',
          architecture: 'Audited blocking assets, upgraded core/theme safely, trimmed redundant scripts, shortened URL slugs with proper 301 redirects, and hardened form endpoints.',
          outcomes: [
            '+49 Lighthouse performance points without disrupting editorial publishing workflows.',
            'Cleaner mobile reading experience and stronger search crawl efficiency.',
            'Less operational noise in the team’s email inboxes.',
          ],
          deliverables: ['Core Web Vitals audit', 'Security & plugin hardening', '301 redirect architecture', 'Maintenance runbook'],
        },
        {
          slug: 'mota-godinho',
          index: '04',
          title: 'Mota & Godinho · UX & Mobile Core Web Vitals',
          client: 'Mota & Godinho',
          year: '2022',
          category: 'UX & Performance',
          metricBadge: '62 -> 91 Lighthouse',
          summary: 'Navigation hierarchy, header/footer refinement, and asset optimization boosting Lighthouse from 62 to 91.',
          image: '/assets/img/port/mota.webp',
          imageAlt: 'Mota & Godinho website preview focused on mobile UX',
          tags: ['UX/UI', 'Mobile-First', 'Performance', 'SEO'],
          externalUrl: 'https://motagodinho.com.br',
          heroMetrics: [
            { value: '62 -> 91', label: 'Lighthouse performance uplift' },
            { value: '+Engagement', label: 'clearer header & footer navigation' },
            { value: 'Mobile', label: 'responsive tuning across small viewports' },
          ],
          challenge: 'Mobile visitors faced slow first paints and unclear navigation paths to services and contact.',
          architecture: 'Refined header/footer information architecture, eliminated render-blocking assets, tuned responsive breakpoints, and updated on-page SEO metadata.',
          outcomes: [
            'Significantly faster page loads on mobile networks.',
            'Higher clarity along primary conversion paths.',
          ],
          deliverables: ['Header & footer UX refresh', 'Asset optimization', 'Responsive layout tuning', 'On-page SEO improvements'],
        },
        {
          slug: 'boas-obras',
          index: '05',
          title: 'Boas Obras · Zero-Cost Brand & Static NGO Portal',
          client: 'NGO Boas Obras (Campinas/Brazil)',
          year: '2015–2022',
          category: 'Identity & Static Web',
          metricBadge: '$0 hosting',
          summary: 'From-scratch brand identity and resilient mobile-first static web platform built on GitHub Pages.',
          image: '/assets/img/port/boas.webp',
          imageAlt: 'Boas Obras NGO static website and brand showcase',
          tags: ['Branding', 'Jekyll / Hugo', 'GitHub Pages', 'Nonprofit'],
          externalUrl: 'https://boasobras.org',
          heroMetrics: [
            { value: '$0/mo', label: 'recurring server hosting cost' },
            { value: '0 -> 1', label: 'complete brand identity & website launch' },
            { value: '7 yrs', label: 'long-term stewardship & SEO updates' },
          ],
          challenge: 'Nonprofit serving elderly citizens, children, and unhoused neighbors needed credible digital outreach with zero infrastructure budget.',
          architecture: 'Designed brand identity and shipped a fast static site powered by Jekyll/Hugo on GitHub Pages with clean mobile typography and zero database maintenance.',
          outcomes: [
            'Zero-cost, highly reliable web presence helping attract volunteers and supporters.',
            'Effortless content publishing over 7+ years.',
          ],
          deliverables: ['Brand identity', 'Static mobile-first website', 'Content & SEO setup', 'Zero-cost hosting pipeline'],
        },
        {
          slug: 'midflow',
          index: '06',
          title: 'MIDFLOW · AI Creative Studio on Cloudflare Edge',
          client: 'Own Product · voaneves',
          year: '2026',
          category: 'SaaS Product & Edge',
          metricBadge: 'React 19 + Edge',
          summary: 'Guided briefing-to-Canvas studio generating Instagram feed posts and 4-screen Stories for Brazilian SMBs.',
          image: '/assets/img/port/app.webp',
          imageAlt: 'Mobile and web app creative studio showcase',
          tags: ['React 19', 'TypeScript', 'Cloudflare Workers', 'Gemini AI', 'PWA'],
          heroMetrics: [
            { value: '1080px', label: 'custom HTML Canvas renderer for feed & Stories' },
            { value: 'Edge', label: 'Cloudflare Worker API with Durable Objects' },
            { value: 'PWA', label: 'offline-capable editor with PNG/ZIP export' },
          ],
          challenge: 'Small businesses spend hours wrestling with complex design suites just to publish consistent weekly Instagram content.',
          architecture: 'Built a React 19 + Zustand PWA frontend paired with a Cloudflare Workers API proxy using Gemini AI, deterministic template fallbacks, and automated axe/bundle checks.',
          outcomes: [
            'Short guided briefings become ready-to-publish carousels, captions, and hashtags.',
            'Predictable edge cost structure ready for commercial SaaS launch.',
          ],
          deliverables: ['Product UX & Canvas engine', 'React 19 PWA application', 'Cloudflare Worker edge API', 'Automated a11y & bundle gates'],
        },
      ],
    },
    services: {
      num: '06',
      tag: '06 · SERVICES',
      title: 'Clear scope, transparent pricing, direct collaboration.',
      subtitle: 'From initial diagnosis to edge deployment — you work directly with the person designing and building your system.',
      ctaLabel: 'Request proposal',
      items: [
        {
          n: '01',
          tag: 'HIGH-SPEED WEB',
          title: 'Website Creation',
          price: 'R$ 800',
          unit: 'from',
          featured: true,
          description: 'Fast, memorable websites engineered for real conversion — pairing editorial typography, technical SEO, accessibility, and edge hosting.',
          deliverables: ['Bespoke UI design', 'Green Core Web Vitals', 'SEO & Schema', 'Mobile-first responsive'],
          waMessage: 'Hi Victor! I would like to discuss creating a new website.',
        },
        {
          n: '02',
          tag: 'APPS & MVPS',
          title: 'App Development',
          price: 'R$ 1,500',
          unit: 'from',
          featured: true,
          description: 'Fluid mobile and web app experiences (React Native, Flutter, or PWA) avoiding cookie-cutter UI with crisp performance.',
          deliverables: ['Interactive Figma prototype', 'Android / iOS / PWA', 'API integrations', 'UX focus'],
          waMessage: 'Hi Victor! I would like to discuss building an application.',
        },
        {
          n: '03',
          tag: 'OPS & STRATEGY',
          title: 'Digital Transformation',
          price: 'R$ 1,200',
          unit: 'from',
          featured: true,
          description: 'End-to-end business modernization using BPMN 2.0 mapping, omnichannel clarity, and lean workflow automation.',
          deliverables: ['AS-IS / TO-BE mapping', 'Low-code automation', 'Data culture', 'Executive roadmap'],
          waMessage: 'Hi Victor! I would like help with Digital Transformation for my business.',
        },
        {
          n: '04',
          tag: 'BUSINESS INTELLIGENCE',
          title: 'Dashboards & BI',
          price: 'R$ 200',
          unit: 'from',
          description: 'Data cleaning, modeling, and interactive Power BI or Qlik Sense dashboards built for faster executive decisions.',
          deliverables: ['ETL & cleanup', 'Power BI / Qlik Sense', 'Actionable KPIs'],
          waMessage: 'Hi Victor! I need BI dashboards to track our business metrics.',
        },
        {
          n: '05',
          tag: 'SEBRAE METHODOLOGY',
          title: '9-Step Productivity Sprint',
          price: 'R$ 800',
          unit: 'from',
          description: 'Structured innovation sprints to eliminate operational waste, sharpen positioning, and increase revenue.',
          deliverables: ['9-step sprint', 'Cost reduction', 'Execution plan'],
          waMessage: 'Hi Victor! I want to run a Productivity Sprint with you.',
        },
        {
          n: '06',
          tag: 'CONTINUOUS CARE',
          title: 'Website Maintenance',
          price: 'R$ 100',
          unit: 'from',
          description: 'Speed tuning, security updates, SEO hygiene, and practical team training so your site stays fast.',
          deliverables: ['Hardening & backups', 'Lighthouse tuning', 'Responsive support'],
          waMessage: 'Hi Victor! I need ongoing maintenance and speed tuning for my site.',
        },
        {
          n: '07',
          tag: '1:1 ADVISORY',
          title: 'Management Consulting',
          price: 'R$ 90',
          unit: '/ hour',
          description: 'Practical working sessions combining analytics, Lean Six Sigma, and OKRs to unblock team execution.',
          deliverables: ['OKR review', 'Executive prioritization'],
          waMessage: 'Hi Victor! I would like to schedule Management Consulting.',
        },
        {
          n: '08',
          tag: 'TECH & APPLIED AI',
          title: 'Digital & AI Consulting',
          price: 'R$ 90',
          unit: '/ hour',
          description: 'Systems architecture, practical generative AI adoption workflows, and hands-on workshops for teams.',
          deliverables: ['Architecture & stack', 'Applied AI workshops'],
          waMessage: 'Hi Victor! I want to book Digital & AI Consulting.',
        },
      ],
    },
    faq: {
      num: '07',
      tag: '07 · FAQ',
      title: 'Common questions before we start.',
      subtitle: 'Straight answers on timelines, remote collaboration, and project kickoff.',
      items: [
        {
          q: 'What is the typical turnaround for a website or BI dashboard?',
          a: 'Focused Power BI dashboards usually ship in 5–10 business days once data access is ready. Complete websites typically take 2–4 weeks, with a live preview link shared from week one for iterative feedback.',
        },
        {
          q: 'Do you work with clients outside Tocantins or outside Brazil?',
          a: 'Yes. While based in Palmas (TO), I work with teams across Brazil and internationally in English, Portuguese, or Spanish through focused async updates and short video check-ins.',
        },
        {
          q: 'How do pricing and milestones work?',
          a: 'After a free 15–30 minute discovery call, you receive a clear proposal detailing scope, deliverables, and schedule. Fixed-scope projects are typically split 50% on kickoff and 50% upon production launch.',
        },
        {
          q: 'What do I need prepared before our first call?',
          a: 'Just clarity on the goal or bottleneck you want solved — whether improving site conversion, rescuing slow pages, automating manual spreadsheets, or mapping processes. I guide the technical discovery.',
        },
      ],
    },
    contact: {
      num: '08',
      tag: '08 · CONTACT',
      title: 'Let us ship something remarkable together.',
      subtitle: 'No bloated forms: grab a 20-minute slot on my calendar, message directly on WhatsApp, or send an email.',
      sla: 'Typical reply ~24h (business days)',
      koalendarLabel: 'Book a meeting (Koalendar)',
      koalendarUrl: 'https://koalendar.com/e/reuniao-com-victor-neves',
      whatsappLabel: 'Message on WhatsApp',
      whatsappUrl: 'https://wa.me/5563999999337?text=Hi%20Victor%2C%20I%20visited%20voaneves.com%20and%20would%20like%20to%20discuss%20a%20project.',
      emailLabel: 'victorneves478@gmail.com',
      emailAddress: 'victorneves478@gmail.com',
      cvLabel: 'Resume / CV (PDF)',
      cvUrl: '/assets/cv-pt.pdf',
      note: 'Palmas, Tocantins, Brazil · Available for select consulting, engineering, and product builds.',
    },
    caseUi: {
      breadcrumbHome: 'Home',
      breadcrumbProjects: 'Projects',
      clientLabel: 'Client / Context',
      yearLabel: 'Timeframe',
      categoryLabel: 'Discipline',
      challengeTitle: '01 · The Challenge',
      architectureTitle: '02 · Strategy & Architecture',
      outcomesTitle: '03 · Verified Outcomes',
      deliverablesTitle: 'Deliverables',
      liveLinkLabel: 'Visit external site',
      prevProject: 'Previous case',
      nextProject: 'Next case',
      ctaHeading: 'Working on a similar challenge?',
      ctaButton: 'Start a conversation',
    },
  },
};
