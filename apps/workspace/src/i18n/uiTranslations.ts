export type UiLanguage = "ru" | "en" | "ja";

export interface UiTranslations {
  languageName: string;
  flag: string;
  nav: {
    coreEngine: string;
    intelligenceOperations: string;
    dashboard: string;
    vectorspace: string;
    adaptive: string;
    search: string;
    recommendations: string;
    catalog: string;
    analytics: string;
    abtest: string;
    conversational: string;
    apiButton: string;
    engineFooterTitle: string;
    engineFooterSub: string;
  };
  topbar: {
    activeSeed: string;
    connectDb: string;
    scaledBadge: string;
    restoreCurated: string;
    scaleTo1200: string;
    csvModal: string;
    apiSdk: string;
    uiLangLabel: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    connectDbBtn: string;
    scaleBtn: string;
    restoreBtn: string;
    openApiBtn: string;
    platformDomainLabel: string;
    kpiCorpusTitle: string;
    kpiEntropyTitle: string;
    kpiEntropySub: string;
    kpiOpsTitle: string;
    kpiOpsSub: string;
    kpiAbTitle: string;
    kpiAbSub: string;
    benchTitle: string;
    benchSub: string;
    benchTopology: string;
    benchStorage: string;
    benchActiveCorpus: string;
    benchVerified: string;
    benchRunBtn: string;
    benchRunningBtn: string;
    benchTest1200: string;
    quickSearchTitle: string;
    quickSearchSub: string;
    quickSearchLabLink: string;
    quickSearchPlaceholder: string;
    quickSearchEmptyHint: string;
    inspectBtn: string;
    modulesTitle: string;
    openModule: string;
    modules: {
      vectorspace: { title: string; desc: string };
      adaptive: { title: string; desc: string };
      search: { title: string; desc: string };
      recommendations: { title: string; desc: string };
      catalog: { title: string; desc: string };
      analytics: { title: string; desc: string };
      abtest: { title: string; desc: string };
      conversational: { title: string; desc: string };
    };
  };
  search: {
    title: string;
    subtitle: string;
    corpusScript: string;
    sideBySideOn: string;
    sideBySideOff: string;
    placeholder: string;
    executeBtn: string;
    searchingBtn: string;
    modePreset: string;
    alphaWeight: string;
    testQueries: string;
    hybridHitsTitle: string;
    legacyHitsTitle: string;
    legacySubtitle: string;
    legacyZeroTitle: string;
    legacyZeroDesc: string;
    securityFilteredBadge: string;
  };
  recommendations: {
    title: string;
    subtitle: string;
    xrayOn: string;
    xrayOff: string;
    mmrBalance: string;
    topKLabel: string;
    activeAnchorBadge: string;
    selectSeedHeader: string;
    filterPlaceholder: string;
    merchandisingTitle: string;
    merchandisingSubtitle: string;
    crossCategoryOnly: string;
    minRatingLabel: string;
    boostCategoryLabel: string;
    boostNone: string;
    boostFactorLabel: string;
    pinnedCountLabel: string;
    excludedCountLabel: string;
    resetRulesBtn: string;
    pinBtn: string;
    unpinBtn: string;
    excludeBtn: string;
    pinnedBadge: string;
    boostedBadge: string;
    metricsBarTitle: string;
    ndcgTooltip: string;
    recallTooltip: string;
    mrrTooltip: string;
    diversityTooltip: string;
    cosineLabel: string;
    noveltyLabel: string;
    mmrScoreLabel: string;
    locate3DBtn: string;
    makeSeedBtn: string;
  };
  catalog: {
    title: string;
    subtitle: string;
    exportJsonBtn: string;
    importJsonBtn: string;
    csvBtn: string;
    addSkuBtn: string;
    filterPlaceholder: string;
    allCategories: string;
    addModalTitle: string;
    saveVectorBtn: string;
    cancelBtn: string;
    securitySanitizedToast: string;
  };
}

export const UI_TRANSLATIONS: Record<UiLanguage, UiTranslations> = {
  ru: {
    languageName: 'Русский',
    flag: '🇷🇺',
    nav: {
      coreEngine: 'ЯДРО ДВИЖКА',
      intelligenceOperations: 'ИНТЕЛЛЕКТ И АНАЛИТИКА',
      dashboard: 'Обзор студии',
      vectorspace: '3D Пространство и Граф',
      adaptive: 'Adaptive Intelligence Lab',
      search: 'Гибридный поиск (BM25+HNSW)',
      recommendations: 'Рекомендации MMR и Правила',
      catalog: 'Каталог и Векторные бандлы',
      analytics: 'Аналитика и Телеметрия',
      abtest: 'A/B Эксперименты',
      conversational: 'Диалоговый NLU Агент',
      apiButton: 'Консоль REST API и SDK',
      engineFooterTitle: 'EIDOS v3.4.0 · 384-d + BM25',
      engineFooterSub: 'HNSW Int32 · < 1 мс p50',
    },
    topbar: {
      activeSeed: 'Активный якорь:',
      connectDb: 'Подключить свою базу / Язык',
      scaledBadge: 'Масштаб: 1 200 SKU',
      restoreCurated: 'Сбросить масштаб',
      scaleTo1200: 'Масштаб 1 200 SKU',
      csvModal: 'Импорт / Экспорт CSV',
      apiSdk: 'API и SDK',
      uiLangLabel: 'Язык UI:',
    },
    dashboard: {
      title: 'Семантическая Векторная Студия Eidos',
      subtitle: '384-мерные dense-эмбеддинги · HNSW Phase 2 (Int32 + BinaryHeap) · Мультиязычность и CJK (100+ языков)',
      connectDbBtn: 'Подключить свою базу / Язык',
      scaleBtn: 'Масштабировать до 1 200 SKU (0 мс)',
      restoreBtn: 'Вернуть базовый каталог',
      openApiBtn: 'Открыть консоль REST API',
      platformDomainLabel: 'Тип площадки и язык базы:',
      kpiCorpusTitle: 'Индексированный каталог и векторы',
      kpiEntropyTitle: 'Таксономическая энтропия Шеннона',
      kpiEntropySub: 'Уникальных семантических категорий:',
      kpiOpsTitle: 'Операции поиска и рекомендаций',
      kpiOpsSub: 'гибридных запросов · MMR ранжирований',
      kpiAbTitle: 'Активные A/B эксперименты',
      kpiAbSub: 'Детерминированный FNV-1a роутинг трафика',
      benchTitle: 'Бенчмарк HNSW Phase 2 против Линейного сканирования',
      benchSub: 'Выполняет 150 реальных 384-d запросов к графу Int32 HNSW и полному косинусному перебору',
      benchTopology: 'Топология графа',
      benchStorage: 'Хранение связей',
      benchActiveCorpus: 'Активный корпус',
      benchVerified: 'Проверено на',
      benchRunBtn: 'Запустить бенчмарк HNSW vs Linear',
      benchRunningBtn: 'Тестирование HNSW vs Linear...',
      benchTest1200: 'Тест на 1 200 SKU',
      quickSearchTitle: 'Мгновенный гибридный векторный поиск',
      quickSearchSub: 'Нажмите на любой результат, чтобы сделать его активным якорем в 3D и рекомендациях',
      quickSearchLabLink: 'Открыть Search Lab →',
      quickSearchPlaceholder: 'Поиск на Русском, English, 日本語, 中文...',
      quickSearchEmptyHint: 'Введите концептуальный запрос выше или протестируйте готовый пресет:',
      inspectBtn: 'Выбрать →',
      modulesTitle: 'Архитектурные модули студии Eidos',
      openModule: 'Открыть модуль',
      modules: {
        vectorspace: {
          title: '3D Векторное пространство и 2D Граф',
          desc: 'WebGL 384-d гиперсфера, слои HNSW L0–L2, INT8 квантование и 2D силовая топология',
        },
        adaptive: {
          title: 'Adaptive Intelligence Lab (AIL)',
          desc: '7-факторный ранжировщик, капсулы MIND, контекстуальные бандиты LinUCB и векторный стиринг',
        },
        search: {
          title: 'Гибридный поиск и сравнение',
          desc: 'Слияние BM25 (CJK + Unicode) + Dense HNSW с настройкой α против обычного поиска по словам',
        },
        recommendations: {
          title: 'MMR Рекомендации, Мерчандайзинг и X-Ray',
          desc: 'Диверсификация MMR, бизнес-правила (Pin/Boost/Filter) и метрики качества NDCG@K / Recall@K',
        },
        catalog: {
          title: 'Каталог и 0ms Векторные бандлы',
          desc: 'Управление позициями, экспорт 384-d JSON бандлов и пакетный импорт CSV/JSON с защитой XSS',
        },
        analytics: {
          title: 'Аналитика и потоковая телеметрия',
          desc: 'Динамика поисковых запросов, семантические кластеры интересов и конверсия CTR в реальном времени',
        },
        abtest: {
          title: 'Статистический A/B Движок',
          desc: 'Двухвыборочный Z-тест статистической значимости для сравнения алгоритмов ранжирования',
        },
        conversational: {
          title: 'Диалоговый Векторный Агент',
          desc: 'Ассистент подбора на естественном языке с извлечением намерений и ограничений бюджета',
        },
      },
    },
    search: {
      title: 'Лаборатория Гибридного Поиска (Dense HNSW + CJK BM25)',
      subtitle: 'Выпуклая комбинация Score(q, d) = α · DenseCosine(q, d) + (1 − α) · BM25(q, d) для 100+ языков',
      corpusScript: 'Язык корпуса:',
      sideBySideOn: 'Сравнение с обычным поиском: ВКЛ',
      sideBySideOff: 'Сравнение с обычным поиском: ВЫКЛ',
      placeholder: 'Введите запрос на любом языке (Русский, English, 日本語, 中文, Español)...',
      executeBtn: 'Найти (Hybrid Search)',
      searchingBtn: 'Поиск...',
      modePreset: 'Режим слияния:',
      alphaWeight: 'Вес вектора α:',
      testQueries: 'Тестовые запросы:',
      hybridHitsTitle: 'Гибридная выдача Eidos',
      legacyHitsTitle: 'Обычный поиск по точным словам',
      legacySubtitle: 'Только точное совпадение подстрок',
      legacyZeroTitle: '0 результатов — Сбой словарного несовпадения (Vocabulary Mismatch)',
      legacyZeroDesc: 'Классический поиск по подстрокам не нашёл совпадений, тогда как гибридный поиск Eidos извлёк концептуально релевантные объекты.',
      securityFilteredBadge: 'SecurityGuardrails: Запрос очищен от опасных паттернов',
    },
    recommendations: {
      title: 'MMR Рекомендации, Бизнес-правила и X-Ray Аудит',
      subtitle: 'Формула MMR: λ · Relevance(q, d) − (1 − λ) · max Similarity(d, S) + Бизнес-правила мерчандайзинга',
      xrayOn: 'X-Ray Декомпозиция: ВКЛ',
      xrayOff: 'X-Ray Декомпозиция: ВЫКЛ',
      mmrBalance: 'Баланс MMR λ:',
      topKLabel: 'Выдача Top-K:',
      activeAnchorBadge: 'Активный якорь',
      selectSeedHeader: 'Выберите якорный объект (Seed SKU)',
      filterPlaceholder: 'Фильтр каталога по названию или категории...',
      merchandisingTitle: 'Студия бизнес-правил и мерчандайзинга (уровень Algolia / AWS Personalize)',
      merchandisingSubtitle: 'Управляйте коммерческими приоритетами поверх математического ранжирования MMR в реальном времени',
      crossCategoryOnly: 'Только кросс-категории (Cross-Sell)',
      minRatingLabel: 'Мин. рейтинг:',
      boostCategoryLabel: 'Бустинг категории:',
      boostNone: 'Без бустинга (1.0x)',
      boostFactorLabel: 'Множитель:',
      pinnedCountLabel: 'Закреплено (Pin):',
      excludedCountLabel: 'Скрыто (Hide):',
      resetRulesBtn: 'Сбросить правила',
      pinBtn: 'Закрепить #1',
      unpinBtn: 'Открепить',
      excludeBtn: 'Скрыть',
      pinnedBadge: '📌 ЗАКРЕПЛЕНО (PINNED)',
      boostedBadge: '🚀 BOOST',
      metricsBarTitle: 'Метрики качества ранжирования (Live IR Evaluation)',
      ndcgTooltip: 'Normalized Discounted Cumulative Gain — качество порядка ранжирования с учётом позиций',
      recallTooltip: 'Доля охваченных релевантных объектов целевого семантического кластера',
      mrrTooltip: 'Mean Reciprocal Rank — обратный ранг первого высокорелевантного ответа (Cosine ≥ 0.65)',
      diversityTooltip: 'Внутрисписковое разнообразие категорий (Intra-List Diversity / Shannon Entropy)',
      cosineLabel: 'Косинусная близость (384-d)',
      noveltyLabel: 'Бонус новизны MMR (1 − maxSim)',
      mmrScoreLabel: 'Итоговый балл MMR (λ-взвешенный)',
      locate3DBtn: 'В 3D граф',
      makeSeedBtn: 'Сделать якорем',
    },
    catalog: {
      title: 'Менеджер каталога и 0ms векторных бандлов',
      subtitle: 'Управление корпусом SKU и предрассчитанными 384-мерными L2-векторами с защитой SecurityGuardrails',
      exportJsonBtn: 'Экспорт 384-d JSON бандла',
      importJsonBtn: 'Импорт JSON бандла (0 мс)',
      csvBtn: 'Импорт / Экспорт CSV',
      addSkuBtn: 'Добавить позицию',
      filterPlaceholder: 'Фильтр по названию, описанию или категории...',
      allCategories: 'Все',
      addModalTitle: 'Добавление новой позиции (Авто-векторизация 384d + XSS Guardrails)',
      saveVectorBtn: 'Сохранить и вычислить 384-d вектор',
      cancelBtn: 'Отмена',
      securitySanitizedToast: 'SecurityGuardrails: Входные данные проверены и очищены от XSS/инъекций',
    },
  },
  en: {
    languageName: 'English',
    flag: '🇺🇸',
    nav: {
      coreEngine: 'CORE ENGINE',
      intelligenceOperations: 'INTELLIGENCE & OPERATIONS',
      dashboard: 'Overview & Studio',
      vectorspace: '3D Vector Space & Graph',
      adaptive: 'Adaptive Intelligence Lab',
      search: 'Hybrid Search (BM25+HNSW)',
      recommendations: 'MMR Recs & Merchandising',
      catalog: 'Catalog & Vector Bundles',
      analytics: 'Recharts Analytics',
      abtest: 'A/B Experiments',
      conversational: 'Conversational NLU',
      apiButton: 'Live REST API & SDK',
      engineFooterTitle: 'EIDOS v3.4.0 · 384-d + BM25',
      engineFooterSub: 'HNSW Int32 · < 2ms p50',
    },
    topbar: {
      activeSeed: 'Active Seed:',
      connectDb: 'Connect Database / Language',
      scaledBadge: 'Scaled: 1,200 SKU',
      restoreCurated: 'Restore Curated',
      scaleTo1200: 'Scale 1,200 SKU',
      csvModal: 'CSV Import / Export',
      apiSdk: 'API & SDK',
      uiLangLabel: 'UI Lang:',
    },
    dashboard: {
      title: 'Eidos Semantic Vector Workbench',
      subtitle: '384-dimensional dense embeddings · HNSW Phase 2 (Int32 + BinaryHeap) · Universal Multilingual & CJK (100+ languages)',
      connectDbBtn: 'Connect Your DB / Language',
      scaleBtn: 'Scale Catalog to 1,200 SKU (0ms)',
      restoreBtn: 'Restore Curated Catalog',
      openApiBtn: 'Open Live REST API Console',
      platformDomainLabel: 'Platform Type & Corpus Language:',
      kpiCorpusTitle: 'Indexed Corpus & Vectors',
      kpiEntropyTitle: 'Catalog Taxonomy Entropy',
      kpiEntropySub: 'Across semantic categories:',
      kpiOpsTitle: 'Session Search & Recs',
      kpiOpsSub: 'hybrid queries · MMR runs',
      kpiAbTitle: 'Active A/B Experiments',
      kpiAbSub: 'Deterministic FNV-1a bucket routing',
      benchTitle: 'HNSW Phase 2 vs. Linear Brute-Force Benchmark',
      benchSub: 'Executes 150 real 384-d queries against both the Int32 HNSW graph and full linear cosine scan',
      benchTopology: 'Graph Topology',
      benchStorage: 'Neighbor Storage',
      benchActiveCorpus: 'Active Corpus',
      benchVerified: 'Verified on',
      benchRunBtn: 'Run HNSW vs Linear Benchmark',
      benchRunningBtn: 'Benchmarking HNSW vs Linear...',
      benchTest1200: 'Test on 1,200 SKU',
      quickSearchTitle: 'Instant Hybrid Vector Search Preview',
      quickSearchSub: 'Click any result to set it as the active seed anchor across 3D Space and Recommendations',
      quickSearchLabLink: 'Full Search Lab →',
      quickSearchPlaceholder: 'Search in Русский, English, 日本語, 中文...',
      quickSearchEmptyHint: 'Enter a conceptual query above or test one of the quick presets below:',
      inspectBtn: 'Inspect →',
      modulesTitle: 'Studio Workbench Modules',
      openModule: 'Open module',
      modules: {
        vectorspace: {
          title: '3D Vector Space & 2D Graph',
          desc: 'WebGL 384-d hypersphere, HNSW L0–L2 layers, INT8 lattice, and 2D force topology',
        },
        adaptive: {
          title: 'Adaptive Intelligence Lab (AIL)',
          desc: '7-factor ranker, MIND multi-interest capsules, LinUCB bandits, and vector steering',
        },
        search: {
          title: 'Hybrid Search & Side-by-Side',
          desc: 'BM25 (CJK + Unicode) + Dense HNSW fusion with convex α control vs. legacy keyword search',
        },
        recommendations: {
          title: 'MMR Recommendations & Merchandising',
          desc: 'Maximal Marginal Relevance diversity re-ranking with Pin/Boost rules & NDCG@K metrics',
        },
        catalog: {
          title: 'Catalog & 0ms Vector Bundles',
          desc: 'Manage SKU inventory, export 384-d JSON bundles, and batch-ingest CSV/JSON safely',
        },
        analytics: {
          title: 'Recharts Trends & Telemetry',
          desc: 'Temporal query volume streams, semantic topic clusters, and live CTR conversion',
        },
        abtest: {
          title: 'Statistical A/B Engine',
          desc: 'Two-tailed Z-test significance evaluation across ranking strategies',
        },
        conversational: {
          title: 'Conversational Vector Agent',
          desc: 'Natural language shopping assistant with intent extraction and latent space shifts',
        },
      },
    },
    search: {
      title: 'Hybrid Search Lab (Dense HNSW + Multilingual CJK BM25)',
      subtitle: 'Convex combination Score(q, d) = α · DenseCosine(q, d) + (1 − α) · BM25(q, d) across 100+ languages',
      corpusScript: 'Corpus Script:',
      sideBySideOn: 'Side-by-Side Comparison: ON',
      sideBySideOff: 'Side-by-Side Comparison: OFF',
      placeholder: 'Enter query in any language (Русский, English, 日本語, 中文, Español)...',
      executeBtn: 'Execute Hybrid Search',
      searchingBtn: 'Searching...',
      modePreset: 'Mode Preset:',
      alphaWeight: 'α Weight:',
      testQueries: 'Test queries:',
      hybridHitsTitle: 'Eidos Hybrid Retrieval',
      legacyHitsTitle: 'Legacy Exact Keyword Search',
      legacySubtitle: 'Substring token matching only',
      legacyZeroTitle: '0 results — Vocabulary / Script Mismatch Failure',
      legacyZeroDesc: 'Traditional whitespace keyword search failed because exact tokens or CJK compounds did not match, whereas Eidos Hybrid Search retrieved conceptually relevant items.',
      securityFilteredBadge: 'SecurityGuardrails: Query sanitized against injection patterns',
    },
    recommendations: {
      title: 'MMR Recommendations, Merchandising & X-Ray Inspector',
      subtitle: 'Maximal Marginal Relevance: λ · Relevance(q, d) − (1 − λ) · max Similarity(d, S) + Business Rules',
      xrayOn: 'X-Ray Decomposition: ON',
      xrayOff: 'X-Ray Decomposition: OFF',
      mmrBalance: 'MMR Balance λ:',
      topKLabel: 'Top-K Limit:',
      activeAnchorBadge: 'Active Anchor',
      selectSeedHeader: 'Select Seed Anchor SKU',
      filterPlaceholder: 'Filter catalog items...',
      merchandisingTitle: 'Merchandising & Business Rules Studio (Algolia / AWS Personalize Grade)',
      merchandisingSubtitle: 'Apply commercial pinning, category boosting, and rating guardrails on top of MMR vector ranking',
      crossCategoryOnly: 'Cross-Category Only (Cross-Sell)',
      minRatingLabel: 'Min Rating:',
      boostCategoryLabel: 'Boost Category:',
      boostNone: 'No Boost (1.0x)',
      boostFactorLabel: 'Multiplier:',
      pinnedCountLabel: 'Pinned SKUs:',
      excludedCountLabel: 'Excluded SKUs:',
      resetRulesBtn: 'Reset Rules',
      pinBtn: 'Pin #1',
      unpinBtn: 'Unpin',
      excludeBtn: 'Exclude',
      pinnedBadge: '📌 PINNED SLOT',
      boostedBadge: '🚀 BOOSTED',
      metricsBarTitle: 'Live Ranking Quality Metrics (IR Evaluation)',
      ndcgTooltip: 'Normalized Discounted Cumulative Gain — measures position-aware ranking quality',
      recallTooltip: 'Proportion of relevant cluster items retrieved in Top-K',
      mrrTooltip: 'Mean Reciprocal Rank — reciprocal position of first high-relevance item (Cosine ≥ 0.65)',
      diversityTooltip: 'Intra-List Category Diversity (Shannon Entropy in bits)',
      cosineLabel: '384-d Cosine Similarity',
      noveltyLabel: 'MMR Novelty Bonus (1 − maxSim)',
      mmrScoreLabel: 'Final MMR Score (λ-weighted)',
      locate3DBtn: 'Locate in 3D',
      makeSeedBtn: 'Make Seed Anchor',
    },
    catalog: {
      title: 'Catalog & 0ms Vector Bundle Manager',
      subtitle: 'Managed SKU corpus and pre-computed 384-d L2 vectors protected by SecurityGuardrails',
      exportJsonBtn: 'Export 384-d JSON Bundle',
      importJsonBtn: 'Import JSON Bundle (0ms)',
      csvBtn: 'CSV Import / Export',
      addSkuBtn: 'Add SKU',
      filterPlaceholder: 'Filter by title, description, or category...',
      allCategories: 'All',
      addModalTitle: 'Add New SKU (Auto-Vectorized to 384d + Security Guardrails)',
      saveVectorBtn: 'Save & Compute 384-d Vector',
      cancelBtn: 'Cancel',
      securitySanitizedToast: 'SecurityGuardrails: Input verified and sanitized against XSS/injection',
    },
  },
  ja: {
    languageName: '日本語',
    flag: '🇯🇵',
    nav: {
      coreEngine: 'コアエンジン',
      intelligenceOperations: 'インテリジェンス＆運用',
      dashboard: 'スタジオ概要',
      vectorspace: '3Dベクトル空間＆グラフ',
      adaptive: '適応型AIラボ (AIL)',
      search: 'ハイブリッド検索 (BM25+HNSW)',
      recommendations: 'MMR推薦＆マーチャンダイジング',
      catalog: 'カタログ＆ベクトル管理',
      analytics: 'リアルタイム分析',
      abtest: 'A/Bテスト検証',
      conversational: '対話型NLUエージェント',
      apiButton: 'REST API＆SDKコンソール',
      engineFooterTitle: 'EIDOS v3.4.0 · 384次元Dense + BM25',
      engineFooterSub: 'HNSW Int32 · 遅延 < 2ms p50',
    },
    topbar: {
      activeSeed: '現在の起点アイテム:',
      connectDb: 'DB接続 / 言語切替',
      scaledBadge: '拡張中: 1,200 SKU',
      restoreCurated: '初期カタログに戻す',
      scaleTo1200: '1,200件にスケール',
      csvModal: 'CSV入出力',
      apiSdk: 'API & SDK',
      uiLangLabel: '表示言語:',
    },
    dashboard: {
      title: 'Eidos セマンティック・ベクトル・ワークベンチ',
      subtitle: '384次元密ベクトル · HNSW Phase 2 (Int32 + BinaryHeap) · 日本語CJK＆100言語以上対応',
      connectDbBtn: 'データベース接続 / 言語選択',
      scaleBtn: '1,200件にスケール (0ms生成)',
      restoreBtn: '基本カタログに戻す',
      openApiBtn: 'REST APIコンソールを開く',
      platformDomainLabel: 'プラットフォーム種別・データベース言語:',
      kpiCorpusTitle: 'インデックス済みアイテム数',
      kpiEntropyTitle: 'カテゴリ多様性エントロピー',
      kpiEntropySub: 'セマンティックカテゴリ数:',
      kpiOpsTitle: 'セッション検索＆推薦回数',
      kpiOpsSub: 'ハイブリッド検索 · MMR推薦実行',
      kpiAbTitle: '稼働中のA/Bテスト',
      kpiAbSub: '決定論的FNV-1aバケットルーティング',
      benchTitle: 'HNSW Phase 2 vs 線形スキャン 高速ベンチマーク',
      benchSub: 'Int32 HNSWグラフと全件コサイン類似度スキャンに対して150回の384次元クエリを実行',
      benchTopology: 'グラフトポロジー',
      benchStorage: '近傍メモリ構造',
      benchActiveCorpus: '対象データ数',
      benchVerified: '検証完了:',
      benchRunBtn: 'HNSW vs 線形スキャンを実行',
      benchRunningBtn: 'ベンチマーク計測中...',
      benchTest1200: '1,200件でテスト',
      quickSearchTitle: '即時ハイブリッド・ベクトル検索プレビュー',
      quickSearchSub: '検索結果をクリックすると、3D空間とMMR推薦の起点（アンカー）に設定されます',
      quickSearchLabLink: '検索ラボを開く →',
      quickSearchPlaceholder: '日本語、English、Русский、中文で検索...',
      quickSearchEmptyHint: '上の検索窓に入力するか、以下のサンプルクエリをお試しください:',
      inspectBtn: '選択 →',
      modulesTitle: 'Eidos スタジオ・モジュール一覧',
      openModule: 'モジュールを開く',
      modules: {
        vectorspace: {
          title: '3Dベクトル空間＆2Dグラフ',
          desc: 'WebGL 384次元超球面、HNSW L0–L2階層、INT8量子化、2D力学グラフの可視化',
        },
        adaptive: {
          title: 'Adaptive Intelligence Lab (AIL)',
          desc: '7要素ランカー、MINDマルチ関心カプセル、LinUCBバンディット、ベクトルステアリング',
        },
        search: {
          title: 'ハイブリッド検索＆比較ラボ',
          desc: '日本語文字バイグラム対応BM25 + Dense HNSWのα融合と従来のキーワード検索の並列比較',
        },
        recommendations: {
          title: 'MMR推薦・ビジネスルール＆X-Ray',
          desc: 'MMR多様性リランキング、固定ピン留め・カテゴリブースト、NDCG@Kリアルタイム評価',
        },
        catalog: {
          title: 'カタログ＆0msベクトルバンドル',
          desc: 'SKU管理、384次元JSONバンドルの入出力、SecurityGuardrailsによる安全なCSV一括取込',
        },
        analytics: {
          title: 'リアルタイム分析＆テレメトリ',
          desc: '検索クエリ推移、セマンティック関心クラスタ、リアルタイムCTRコンバージョン計測',
        },
        abtest: {
          title: '統計的A/Bテストエンジン',
          desc: '両側Z検定によるランキングアルゴリズムの統計的有意差（p値）の自動検証',
        },
        conversational: {
          title: '対話型ベクトルNLUエージェント',
          desc: '自然言語から意図・予算・カテゴリ制約を抽出して推薦するAIアシスタント',
        },
      },
    },
    search: {
      title: 'ハイブリッド検索ラボ (Dense HNSW + 日本語CJK対応 BM25)',
      subtitle: '凸結合スコア Score(q, d) = α · DenseCosine(q, d) + (1 − α) · BM25(q, d) · 100言語以上対応',
      corpusScript: 'コーパス言語:',
      sideBySideOn: '従来検索との並列比較: ON',
      sideBySideOff: '従来検索との並列比較: OFF',
      placeholder: 'あらゆる言語で検索クエリを入力 (日本語, English, Русский, 中文)...',
      executeBtn: 'ハイブリッド検索を実行',
      searchingBtn: '検索中...',
      modePreset: 'モードプリセット:',
      alphaWeight: 'ベクトル重み α:',
      testQueries: 'テストクエリ:',
      hybridHitsTitle: 'Eidos ハイブリッド検索結果',
      legacyHitsTitle: '従来の完全一致キーワード検索',
      legacySubtitle: '空白区切りトークン一致のみ',
      legacyZeroTitle: '0件 — 語彙不一致 / CJK分かち書き不一致による検索失敗',
      legacyZeroDesc: '従来のキーワード検索ではスペースのない日本語複合語や類義語が一致しませんでしたが、Eidosハイブリッド検索は意味的に関連するアイテムを正確に抽出しました。',
      securityFilteredBadge: 'SecurityGuardrails: 不正なインジェクションパターンを無害化しました',
    },
    recommendations: {
      title: 'MMR推薦・マーチャンダイジング＆X-Rayインスペクタ',
      subtitle: 'Maximal Marginal Relevance: λ · 関連度(q, d) − (1 − λ) · max 類似度(d, S) + ビジネスルール制御',
      xrayOn: 'X-Ray スコア分解: ON',
      xrayOff: 'X-Ray スコア分解: OFF',
      mmrBalance: 'MMRバランス λ:',
      topKLabel: '表示件数 Top-K:',
      activeAnchorBadge: '選択中の起点',
      selectSeedHeader: '起点アイテム (Seed SKU) を選択',
      filterPlaceholder: 'タイトルやカテゴリで絞り込み...',
      merchandisingTitle: 'マーチャンダイジング＆ビジネスルール (Algolia / AWS Personalize 水準)',
      merchandisingSubtitle: 'MMRベクトル推薦の上に、優先ピン留め・カテゴリブースト・最低評価フィルタをリアルタイム適用',
      crossCategoryOnly: '別カテゴリのみ推薦 (クロスセル)',
      minRatingLabel: '最低評価:',
      boostCategoryLabel: 'カテゴリ強化:',
      boostNone: 'ブーストなし (1.0x)',
      boostFactorLabel: '倍率:',
      pinnedCountLabel: 'ピン留め数:',
      excludedCountLabel: '除外アイテム数:',
      resetRulesBtn: 'ルールをリセット',
      pinBtn: '#1に固定',
      unpinBtn: '固定解除',
      excludeBtn: '除外する',
      pinnedBadge: '📌 優先固定 (PINNED)',
      boostedBadge: '🚀 ブースト適用',
      metricsBarTitle: 'ランキング品質リアルタイム評価指標 (IR Metrics)',
      ndcgTooltip: 'Normalized Discounted Cumulative Gain — 順位の重みを考慮したランキング品質指標',
      recallTooltip: '同一セマンティッククラスタ内の関連アイテム網羅率',
      mrrTooltip: 'Mean Reciprocal Rank — 最初の高関連アイテム(Cosine ≥ 0.65)の逆順位',
      diversityTooltip: '推薦リスト内のカテゴリ多様性（シャノン・エントロピー bit）',
      cosineLabel: '384次元コサイン類似度',
      noveltyLabel: 'MMR新規性ボーナス (1 − maxSim)',
      mmrScoreLabel: '最終MMRスコア (λ加重)',
      locate3DBtn: '3D空間で表示',
      makeSeedBtn: 'このアイテムを起点にする',
    },
    catalog: {
      title: 'カタログ＆0msベクトルバンドル管理',
      subtitle: 'SecurityGuardrailsで保護されたSKUコーパスと384次元L2正規化ベクトルの管理',
      exportJsonBtn: '384次元JSONバンドル出力',
      importJsonBtn: 'JSONバンドル取込 (0ms)',
      csvBtn: 'CSV インポート / エクスポート',
      addSkuBtn: '新規アイテム追加',
      filterPlaceholder: 'タイトル、説明、カテゴリで検索...',
      allCategories: 'すべて',
      addModalTitle: '新規アイテム追加 (384次元自動ベクトル化 + XSS防御)',
      saveVectorBtn: '保存して384次元ベクトルを計算',
      cancelBtn: 'キャンセル',
      securitySanitizedToast: 'SecurityGuardrails: 入力データを検証し無害化しました',
    },
  },
};
