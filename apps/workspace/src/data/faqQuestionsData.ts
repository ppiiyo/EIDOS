import { FaqQuestionItem } from './faqGuideData';

export const FAQ_QUESTIONS_DATA: FaqQuestionItem[] = [
  {
    id: 'faq-what-is-eidos-simple',
    audience: 'merch',
    roleBadge: { ru: 'Основы простыми словами', en: 'Plain-English Basics' },
    question: {
      ru: 'Чем наш умный поиск отличается от обычного поиска, который уже есть на сайте или в 1С-Битрикс?',
      en: 'How is EIDOS different from the standard search bar already built into my website or CMS?',
    },
    shortAnswer: {
      ru: 'Обычный поиск ищет только точное совпадение букв (как поиск слова в блокноте), а EIDOS понимает человеческий смысл, синонимы, разговорную речь, опечатки и покупательскую задачу.',
      en: 'Standard search only matches literal characters, whereas EIDOS understands meaning, synonyms, slang, typos, and shopping intent.',
    },
    detailedSteps: {
      ru: [
        'В обычном поиске: если товар называется «Толстовка мужская с капюшоном», а покупатель ввёл «тёплое худи на осень» или «кофта для прогулок» — сайт выдаст «Ничего не найдено», и вы потеряете клиента.',
        'В EIDOS: система понимает, что «худи», «толстовка» и «кофта с капюшоном» — это одно и то же по смыслу, и мгновенно покажет нужные товары.',
        'При этом точный поиск по артикулам, брендам и кодам деталей (например, «SKU-405» или «Bosch GSR 18V») тоже работает безупречно благодаря гибридному режиму.',
      ],
      en: [
        'Standard search fails when a customer searches for "warm autumn hoodie" if the product title only says "Men\'s Hooded Sweatshirt".',
        'EIDOS understands that both phrases mean the same product and immediately displays the right items.',
        'At the same time, exact SKU and brand lookups still match with 100% lexical precision.',
      ],
    },
    businessImpact: {
      ru: 'Рост конверсии из поиска в покупку в среднем на +20–35% и сохранение рекламного бюджета, который раньше сливался на пустые страницы.',
      en: '+20–35% higher search-to-purchase conversion and zero wasted ad spend on empty search pages.',
    },
    relatedView: 'search',
  },
  {
    id: 'faq-seo-benefits',
    audience: 'seo',
    roleBadge: { ru: 'Для SEO-менеджера', en: 'For SEO Managers' },
    question: {
      ru: 'Я SEO-специалист. Как этот проект поможет мне поднять трафик из Яндекса и Google и улучшить поведенческие факторы?',
      en: 'I am an SEO manager. How does EIDOS help grow organic search traffic and behavioral metrics?',
    },
    shortAnswer: {
      ru: 'EIDOS решает сразу 3 главные боли SEO: убирает отказы со страниц «0 результатов», даёт готовую семантику живых запросов покупателей и создаёт идеальную внутреннюю перелинковку в карточках товаров.',
      en: 'EIDOS eliminates zero-result bounce rates, reveals real user search vocabulary for new SEO landing pages, and automates smart internal linking.',
    },
    detailedSteps: {
      ru: [
        '1. Улучшение поведенческих факторов (ПФ): когда человек переходит из Яндекса/Google и пользуется поиском или блоком рекомендаций, он больше не видит «Ничего не найдено». Глубина просмотра вырастает на 25–40%, а процент отказов падает — поисковики видят это и поднимают сайт в ТОП.',
        '2. Поиск новых низкочастотных (НЧ) и среднечастотных (СЧ) ключей: во вкладке «SEO и мерчандайзинг» вы видите реальные фразы, которые люди вводят руками. Это готовые темы для новых SEO-фильтров, теговых страниц и статей в блог.',
        '3. Умная перелинковка карточек: блок «Похожие товары» подбирает действительно близкие по смыслу товары, распределяя ссылочный вес внутри каталога гораздо качественнее случайных списков.',
      ],
      en: [
        '1. Better Behavioral Signals: Zero-result semantic recovery prevents visitors from bouncing back to Google/Yandex.',
        '2. Real Keyword Discovery: The SEO Insights tab shows exact natural-language queries your visitors type, ready to turn into SEO category tags.',
        '3. Semantic Internal Linking: Recommendations link genuinely related products together, improving crawl depth.',
      ],
    },
    businessImpact: {
      ru: 'Снижение показателя отказов (Bounce Rate), рост глубины сессии и готовый список конверсионных ключевых фраз без платных парсеров.',
      en: 'Lower bounce rate, deeper session engagement, and a live stream of high-intent long-tail keywords.',
    },
    relatedView: 'seo',
  },
  {
    id: 'faq-smm-benefits',
    audience: 'smm',
    roleBadge: { ru: 'Для SMM и таргетологов', en: 'For SMM & Marketers' },
    question: {
      ru: 'Я SMM-менеджер / таргетолог. Чем этот инструмент полезен для соцсетей, посевов у блогеров и платной рекламы?',
      en: 'I run SMM and paid social campaigns. How does EIDOS help my social traffic convert better?',
    },
    shortAnswer: {
      ru: 'Холодный трафик из соцсетей (Telegram, ВК, Рилс, YouTube) не знает точных названий ваших моделей — люди ищут эмоциями и задачами. EIDOS превращает таких посетителей в покупателей с первых секунд.',
      en: 'Social media traffic searches by vibe, problem, or influencer slang rather than formal catalog titles. EIDOS matches their language immediately.',
    },
    detailedSteps: {
      ru: [
        '1. Понимание сленга и описаний из рекламы: если блогер в обзоре назвал товар «та самая лампа для атмосферных сторис», покупатель введёт это в поиск — и EIDOS найдёт ваш кольцевой RGB-светильник по смыслу.',
        '2. Приоритизация акционных товаров в 1 клик: перед выходом поста в Telegram вы заходите во вкладку «Песочница ранжирования», двигаете ползунок «Свежесть / Новинки» — и рекламируемая коллекция автоматически поднимается на первые места.',
        '3. Диалоговый AI-консультант для мобильного трафика: 85% людей из соцсетей заходят с телефона. Вместо мелких галочек в фильтрах они пишут в чат «подбери кроссовки для зала до 8000 ₽» и сразу покупают.',
        '4. Идеи для контент-плана: в разделе «SEO и мерчандайзинг» и «Аналитика» видно, какие запросы и категории сейчас взлетают в трендах — берите их прямо в заголовки своих постов и рилс!',
      ],
      en: [
        '1. Understands Influencer Slang: Matches conversational phrases from social videos directly to your formal product catalog.',
        '2. Instant Campaign Boosting: Use the Ranking Playground sliders to push new arrivals or high-margin campaign items to the top before a post goes live.',
        '3. Mobile-Friendly Chat Shopping: Social visitors on phones can ask the AI assistant in plain text instead of struggling with mobile filter menus.',
      ],
    },
    businessImpact: {
      ru: 'Окупаемость рекламы (ROAS / ROMI) выше за счёт того, что люди из соцсетей мгновенно находят товар, о котором читали в посте.',
      en: 'Higher ROAS/ROMI on paid social and influencer campaigns by removing friction between ad hooks and product discovery.',
    },
    relatedView: 'ranking',
  },
  {
    id: 'faq-bitrix-setup',
    audience: 'integration',
    roleBadge: { ru: '1С-Битрикс и CMS', en: '1C-Bitrix & CMS' },
    question: {
      ru: 'Как подключить наш проект к сайту на 1С-Битрикс или WooCommerce? Нужно ли переделывать весь сайт?',
      en: 'How do I connect EIDOS to 1C-Bitrix or WooCommerce? Do we need to rebuild our website?',
    },
    shortAnswer: {
      ru: 'Ничего переделывать не нужно! Подключение занимает 2 минуты: вы просто устанавливаете готовый модуль, вводите адрес сервера и ваш API-ключ и нажимаете две кнопки — «Проверить связь» и «Синхронизировать каталог».',
      en: 'No site rebuild needed! Install the ready-made plugin, enter your server URL and API key, and click "Test Connection" and "Sync Catalog".',
    },
    detailedSteps: {
      ru: [
        'Шаг 1: В верхней панели этой студии нажмите кнопку «Подключить БД» и выберите вкладку «1С-Битрикс (eidos.connector)» (или скопируйте модуль из папки packages/connectors/bitrix).',
        'Шаг 2: В админке 1С-Битрикс откройте «Настройки → Настройки модулей → EIDOS» и вставьте адрес сервера и ваш ключ (по умолчанию eidos_dev_key).',
        'Шаг 3: Нажмите «Проверить связь» — вы увидите зелёный статус. Затем нажмите «Синхронизировать каталог» — все товары вашего инфоблока автоматически загрузятся в умный поиск.',
        'Шаг 4: Важная защита! В модуль уже встроена страховка (Fallback): если вдруг пропадёт связь с интернетом, сайт автоматически и незаметно для покупателя переключится на обычный поиск Битрикса. Магазин не остановится ни на секунду.',
      ],
      en: [
        'Step 1: Click "Connect DB" in the top bar of this studio and open the "1C-Bitrix (eidos.connector)" tab.',
        'Step 2: Paste your EIDOS Server URL and API Key into the Bitrix module settings page.',
        'Step 3: Click "Test Connection" and "Sync Catalog" to index your products.',
        'Step 4: Built-in safety: If the network ever drops, the module automatically falls back to native CMS search so your store never breaks.',
      ],
    },
    businessImpact: {
      ru: 'Запуск на боевом сайте за 1 день без остановки продаж и со 100% страховкой от любых сетевых сбоев.',
      en: 'Go live on your production store in minutes with zero downtime and automatic fallback safety.',
    },
    relatedView: 'settings',
  },
  {
    id: 'faq-merchandising-margin',
    audience: 'merch',
    roleBadge: { ru: 'Для коммерции и прибыли', en: 'For Merchandising & Profit' },
    question: {
      ru: 'Как поднять в поиске товары, которые приносят нам больше чистой прибыли (высокую маржу), но не испортить выдачу?',
      en: 'How can we promote products with higher profit margins without showing irrelevant junk to shoppers?',
    },
    shortAnswer: {
      ru: 'Для этого создана вкладка «Песочница ранжирования». Она работает умно: сначала отбирает только те товары, которые реально подходят покупателю по смыслу, а уже среди них ставит выше самые прибыльные для вас позиции.',
      en: 'Use the Ranking Playground sliders. EIDOS first filters for genuinely relevant products, and then ranks higher-margin items at the top of that relevant set.',
    },
    detailedSteps: {
      ru: [
        '1. Откройте вкладку «Песочница ранжирования» в левом меню.',
        '2. Введите любой популярный поисковый запрос вашего магазина и посмотрите на текущую выдачу.',
        '3. Плавно увеличьте ползунок «Вес маржинальности (Прибыль)» — например, с 10% до 30%.',
        '4. На каждой карточке товара вы увидите цветную полоску (X-Ray): зеленый цвет покажет вклад смысла, а синий — сколько баллов добавила высокая маржа. Покупатель видит релевантный товар, а вы зарабатываете больше с каждого заказа!',
      ],
      en: [
        '1. Open the "Ranking Playground" tab in the left sidebar.',
        '2. Increase the "Profit Margin Weight" slider (e.g., from 10% to 30%).',
        '3. Inspect the color-coded contribution bar on each card to see how semantic match and profit margin combine.',
      ],
    },
    businessImpact: {
      ru: 'Увеличение валовой прибыли (Gross Margin) с каждого заказа на +10–18% без увеличения рекламного бюджета.',
      en: '+10–18% higher gross margin per order from the exact same traffic volume.',
    },
    relatedView: 'ranking',
  },
  {
    id: 'faq-echo-chamber-mmr',
    audience: 'merch',
    roleBadge: { ru: 'Рекомендации и чек', en: 'Recommendations & AOV' },
    question: {
      ru: 'Почему на многих сайтах в блоке «Похожие товары» показываются 10 одинаковых товаров разного размера, и как у нас это исправлено?',
      en: 'Why do most websites show 10 nearly identical items in "Similar Products", and how does EIDOS fix this?',
    },
    shortAnswer: {
      ru: 'В EIDOS встроен алгоритм разнообразия (MMR). Он специально штрафует товары-клоны, чтобы в блоке рекомендаций покупатель видел богатый выбор, а не 6 одинаковых футболок.',
      en: 'EIDOS uses Maximal Marginal Relevance (MMR) to penalize near-duplicates so shoppers see a diverse, inspiring selection.',
    },
    detailedSteps: {
      ru: [
        '1. Перейдите во вкладку «Рекомендации» и выберите любой товар.',
        '2. Обратите внимание на ползунок «Разнообразие выдачи (MMR λ)». Если поставить его на 0 — вы увидите только самые близкие аналоги.',
        '3. Если поставить его на 35–45% (рекомендуемый режим) — первый товар будет прямым аналогом, второй — из смежной подрубрики, третий — полезным аксессуаром.',
      ],
      en: [
        '1. Open the "Recommendations" tab and select any anchor item.',
        '2. Set the "Diversity (MMR λ)" slider to 0.35–0.45.',
        '3. Notice how the carousel mixes direct alternatives with complementary items to maximize basket size.',
      ],
    },
    businessImpact: {
      ru: 'Выше кликабельность (CTR) блока рекомендаций и рост количества товаров в одной корзине.',
      en: 'Higher recommendation click-through rate (CTR) and more multi-item carts.',
    },
    relatedView: 'recommendations',
  },
  {
    id: 'faq-zero-ai-bills',
    audience: 'ops',
    roleBadge: { ru: 'Экономия бюджета', en: 'Zero API Tax' },
    question: {
      ru: 'Нужно ли нам каждый месяц платить за OpenAI (ChatGPT) или покупать дорогие видеокарты, чтобы работал поиск по смыслу?',
      en: 'Do we have to pay monthly OpenAI API bills or rent expensive GPU servers to run semantic search?',
    },
    shortAnswer: {
      ru: 'Нет! 0 рублей за внешние AI-сервисы. Вся математика и распознавание смысла на русском, английском, японском и китайском языках уже встроены внутрь нашего движка и работают на обычном процессоре.',
      en: 'No! $0 in external AI API fees. Multilingual semantic vectorization is built directly into EIDOS and runs on standard CPUs.',
    },
    detailedSteps: {
      ru: [
        '1. В отличие от многих сервисов, которые отправляют каждый запрос покупателя в платный OpenAI API (и берут деньги за каждый клик), EIDOS создаёт смысловые векторы локально на вашем сервере за 1–2 миллисекунды.',
        '2. Ваши данные о товарах и покупателях никуда не уходят на сторону — всё остаётся на 100% внутри вашего контура.',
        '3. А благодаря вкладке «Менеджер индексов» (сжатие INT8) вся база потребляет в 4 раза меньше оперативной памяти.',
      ],
      en: [
        '1. EIDOS computes 384-dimensional vectors locally on CPU in under 2ms—no external API keys or per-query charges.',
        '2. 100% data privacy: your catalog and customer queries never leave your server.',
        '3. INT8 quantization in the Index Manager cuts RAM requirements by 4×.',
      ],
    },
    businessImpact: {
      ru: 'Экономия от $500 до $3,000+ в месяц по сравнению с облачными подписками Algolia, Pinecone или платными AI API.',
      en: 'Saves $500 to $3,000+/month compared to SaaS per-request pricing and external embedding APIs.',
    },
    relatedView: 'indexes',
  },
  {
    id: 'faq-cold-start-visitors',
    audience: 'smm',
    roleBadge: { ru: 'Новые посетители', en: 'First-Time Visitors' },
    question: {
      ru: 'Как система рекомендует товары новому человеку, который перешёл по рекламе впервые и мы о нём ещё ничего не знаем?',
      en: 'How does EIDOS personalize recommendations for a brand-new visitor when we have zero history on them?',
    },
    shortAnswer: {
      ru: 'Через «Адаптивный движок» (алгоритм контекстных бандитов). Ему не нужна регистрация клиента: достаточно буквально 1–2 кликов по любым карточкам в текущей сессии, чтобы лента мгновенно подстроилась под вкус гостя.',
      en: 'Through the Adaptive Engine (Contextual Bandits). It learns a visitor\'s taste live from their first 1–2 clicks without needing account login.',
    },
    detailedSteps: {
      ru: [
        '1. Пока человек ничего не нажал, система показывает проверенные хиты и разнообразную витрину.',
        '2. Как только посетитель кликнул на товар или добавил его в избранное/корзину, сайт отправляет лёгкий сигнал (событие click или purchase).',
        '3. Вы можете сами проверить это прямо сейчас: откройте вкладку «Адаптивный движок», нажмите «Лайк» или «Покупка» на любом товаре и посмотрите, как за 3 миллисекунды перестроится вся витрина!',
      ],
      en: [
        '1. Before any clicks, EIDOS blends popular items with high-diversity discovery.',
        '2. As soon as the shopper clicks or likes an item, the session vector updates in real time.',
        '3. Try it live in the "Adaptive Engine" tab by clicking Like, Click, or Purchase on any card.',
      ],
    },
    businessImpact: {
      ru: 'Максимальная отдача от холодного рекламного трафика с первого же визита без обязательной регистрации.',
      en: 'Maximizes conversion from cold ad traffic on the very first visit without forcing account creation.',
    },
    relatedView: 'adaptive',
  },
];
