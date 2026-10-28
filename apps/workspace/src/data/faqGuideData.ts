import { ViewId } from '../components/Sidebar';

export type FaqAudienceId = 'all' | 'seo' | 'smm' | 'merch' | 'integration' | 'ops';

export interface FeatureGuideItem {
  id: ViewId;
  emoji: string;
  badge: { ru: string; en: string };
  title: { ru: string; en: string };
  whatIsIt: { ru: string; en: string };
  whyNeeded: { ru: string; en: string };
  howItWorks: { ru: string; en: string };
  realExample: { ru: string; en: string };
}

export interface FaqQuestionItem {
  id: string;
  audience: FaqAudienceId;
  roleBadge: { ru: string; en: string };
  question: { ru: string; en: string };
  shortAnswer: { ru: string; en: string };
  detailedSteps: { ru: string[]; en: string[] };
  businessImpact: { ru: string; en: string };
  relatedView?: ViewId;
}

export const AUDIENCE_FILTERS: Array<{ id: FaqAudienceId; label: { ru: string; en: string } }> = [
  { id: 'all', label: { ru: '🌟 Все роли и вопросы', en: '🌟 All Roles & Topics' } },
  { id: 'seo', label: { ru: '🎯 Для SEO-специалистов', en: '🎯 For SEO Managers' } },
  { id: 'smm', label: { ru: '📣 Для SMM и таргетологов', en: '📣 For SMM & Paid Traffic' } },
  { id: 'merch', label: { ru: '💰 Для коммерции и продаж', en: '💰 For E-Commerce & Sales' } },
  { id: 'integration', label: { ru: '🔌 Подключение к Битрикс / Сайту', en: '🔌 Bitrix & CMS Setup' } },
  { id: 'ops', label: { ru: '🛡️ Надёжность и экономия бюджета', en: '🛡️ Reliability & Budget' } },
];

export const FEATURE_GUIDE_ITEMS: FeatureGuideItem[] = [
  {
    id: 'dashboard',
    emoji: '📊',
    badge: { ru: 'Главный экран', en: 'Control Center' },
    title: { ru: 'Обзор платформы (Dashboard)', en: 'Platform Overview (Dashboard)' },
    whatIsIt: {
      ru: 'Единый пульт управления вашим магазином или каталогом, где на одном экране видны количество товаров, скорость поиска и готовые шаблоны под разные сферы бизнеса.',
      en: 'A single command center showing your catalog size, live search speed, and one-click industry templates.',
    },
    whyNeeded: {
      ru: 'Чтобы руководитель, маркетолог или владелец магазина за 5 секунд понял: всё ли работает быстро, сколько товаров загружено и как система ведёт себя на разных нишах (Электроника, Одежда, Медиа, B2B).',
      en: 'Lets store owners and marketers verify system health and preview different business verticals in 5 seconds.',
    },
    howItWorks: {
      ru: 'Вы можете переключать готовые базы товаров (например, «Маркетплейс электроники» или «Магазин одежды»), проверять скорость отклика (в среднем 2–5 миллисекунд — быстрее моргания глаза) и в 1 клик открывать подключение своей базы.',
      en: 'Switch between industry presets, test sub-5ms query speed, or open the 1-click database connector.',
    },
    realExample: {
      ru: 'Пример: Вы хотите показать директору, как умный поиск будет работать на вашем ассортименте. Нажимаете «Подключить БД → Импорт JSON/CSV», загружаете прайс-лист — и вся панель сразу оживает с вашими товарами.',
      en: 'Example: Upload your product spreadsheet via CSV/JSON import and immediately demonstrate live semantic search to stakeholders.',
    },
  },
  {
    id: 'seo',
    emoji: '🎯',
    badge: { ru: 'Хит для SEO и SMM', en: 'SEO & SMM Essential' },
    title: { ru: 'SEO и мерчандайзинг (Спасение нулевой выдачи)', en: 'SEO & Merchandising (Zero-Result Recovery)' },
    whatIsIt: {
      ru: 'Аналитическая панель, которая показывает, что именно люди ищут на вашем сайте, какие запросы приносят больше всего покупок и как система спасает клиентов, которые раньше натыкались на пустую страницу «Ничего не найдено».',
      en: 'Shows top user queries, conversion rates, and how the engine automatically rescues "0 results found" searches.',
    },
    whyNeeded: {
      ru: 'Для SEO-менеджера и SMM-специалиста это готовый источник идей для посадочных страниц, статей и рекламных постов! Вы видите живой язык покупателей (как они реально называют ваши товары) и не теряете платный рекламный трафик из-за опечаток или разговорных фраз.',
      en: 'Gives SEO and SMM teams real customer vocabulary for landing pages and ad campaigns while preventing paid traffic bounce on zero-result searches.',
    },
    howItWorks: {
      ru: 'В обычном поиске, если человек написал «шумодав для самолета», а у вас в карточке написано «Наушники с ANC», сайт напишет «Найдено 0 товаров» — и клиент уйдёт к конкурентам. EIDOS понимает смысл фразы, автоматически подбирает наушники с шумоподавлением и записывает этот случай в таблицу «Спасённые запросы».',
      en: 'When exact keyword matching finds 0 items, EIDOS automatically falls back to meaning-based vector matching and logs the recovered query.',
    },
    realExample: {
      ru: 'Пример для SEO/SMM: Вы видите в таблице, что 450 человек искали «подарок для стримера», а у вас нет такой категории. Вы создаёте SEO-подборку под этот запрос и запускаете таргет ВК/Telegram с этой же фразой — получая дешёвые лиды!',
      en: 'Example: Spot high-volume customer phrases in the SEO table and turn them into high-converting SEO landing pages and social ad hooks.',
    },
  },
  {
    id: 'search',
    emoji: '🔍',
    badge: { ru: 'Ядро продаж', en: 'Core Search' },
    title: { ru: 'Гибридный поиск + Рентген выдачи (X-Ray)', en: 'Hybrid Search + Explainable X-Ray' },
    whatIsIt: {
      ru: 'Умная поисковая строка, которая одновременно ищет и по точному совпадению букв/артикулов, и по смыслу человеческой речи, а также показывает прозрачную формулу («Рентген») для каждого найденного товара.',
      en: 'Combines exact SKU/keyword matching with deep meaning comprehension, showing a visual score breakdown for every result.',
    },
    whyNeeded: {
      ru: 'Покупатели ищут по-разному: снабженец вводит точный артикул «SKU-902», а обычный человек пишет «что-нибудь уютное для чтения вечером». Гибридный поиск идеально обрабатывает оба случая сразу.',
      en: 'Handles both exact part-number lookups and vague natural-language intent in a single search bar.',
    },
    howItWorks: {
      ru: 'Ползунок Alpha (α) регулирует баланс: сдвиньте влево — будет строгий поиск по словам (как в старых магазинах); сдвиньте вправо — поиск по смыслу и ассоциациям; оставьте посередине (65%) — получите золотую середину. Под каждым товаром видна полоска X-Ray: сколько баллов дал смысл, а сколько — точные слова.',
      en: 'The Alpha slider balances keyword precision vs. semantic meaning, while X-Ray bars explain why each product ranked where it did.',
    },
    realExample: {
      ru: 'Пример: Клиент из рекламы в соцсетях заходит и пишет сленгом «уши для бега чтобы не выпадали». Обычный поиск выдаст пустоту, а EIDOS за 3 миллисекунды покажет спортивные Bluetooth-наушники.',
      en: 'Example: A shopper types conversational slang from a social ad and immediately gets relevant products instead of an empty page.',
    },
  },
  {
    id: 'ranking',
    emoji: '⚖️',
    badge: { ru: 'Управление прибылью', en: 'Profit Control' },
    title: { ru: 'Песочница ранжирования (Ranking Playground)', en: 'Ranking Playground (Merchandising Sliders)' },
    whatIsIt: {
      ru: 'Интерактивный пульт мерчандайзера с 4 простыми ползунками: Семантическая точность, Маржинальность (ваша наценка/прибыль), Популярность (хиты) и Свежесть (новинки).',
      en: 'An interactive control panel with 4 sliders: Semantic Relevance, Profit Margin, Popularity, and Freshness.',
    },
    whyNeeded: {
      ru: 'Магазину невыгодно показывать на первом месте дешёвый товар с нулевой наценкой или товар, который заканчивается на складе. Здесь коммерческий директор или маркетолог может без программистов настроить выдачу так, чтобы сверху шли самые выгодные для бизнеса позиции.',
      en: 'Lets merchandisers boost high-margin items, new arrivals, or bestsellers to the top of search results without developer help.',
    },
    howItWorks: {
      ru: 'Вы двигаете ползунок «Вес маржинальности» — и прямо на экране видите, как товары с высокой прибылью поднимаются на 1–3 места, но при этом остаются строго подходящими под запрос покупателя!',
      en: 'Drag the Margin or Freshness slider and watch products reorder in real time with full score transparency.',
    },
    realExample: {
      ru: 'Пример: Перед запуском SMM-кампании на новую коллекцию вы поднимаете ползунок «Свежесть (Новинки)» до 35% — и все новинки автоматически получают приоритет в поиске и рекомендациях.',
      en: 'Example: Before a seasonal campaign, increase the Freshness slider so new collection items automatically surface first.',
    },
  },
  {
    id: 'recommendations',
    emoji: '✨',
    badge: { ru: 'Рост среднего чека', en: 'Upsell & Cross-Sell' },
    title: { ru: 'Умные рекомендации и защита от клонов (MMR)', en: 'Smart Recommendations & Diversity (MMR)' },
    whatIsIt: {
      ru: 'Генератор блоков «Похожие товары», «С этим покупают» и «Вам может понравиться» с защитой от однообразия выдачи.',
      en: 'Generates "Similar Items" and "Complete the Look" carousels with built-in anti-duplicate diversification.',
    },
    whyNeeded: {
      ru: 'Классические рекомендательные системы часто совершают глупую ошибку: если человек смотрит чёрную куртку, они показывают ему ещё 6 точно таких же чёрных курток. Покупателю становится скучно. Наш ползунок «Разнообразие (MMR)» делает подборку живой и интересной.',
      en: 'Prevents showing 6 nearly identical items in a recommendation carousel, increasing cross-category discovery and average order value.',
    },
    howItWorks: {
      ru: 'Выберите любой товар из каталога и двигайте ползунок «Разнообразие»: при низком значении система покажет ближайшие аналоги, а при повышении — добавит сопутствующие товары и альтернативные стили, которые увеличивают средний чек корзины.',
      en: 'Select an anchor product and adjust the Diversity slider to blend close substitutes with complementary accessories.',
    },
    realExample: {
      ru: 'Пример: Покупатель смотрит фотоаппарат. Вместо 5 одинаковых камер система рекомендует 2 альтернативные камеры, объектив, карту памяти и штатив — средний чек заказа вырастает на 30%!',
      en: 'Example: Alongside a camera, recommend a lens, tripod, and memory card instead of 5 identical camera bodies.',
    },
  },
  {
    id: 'catalog',
    emoji: '📦',
    badge: { ru: 'Управление товарами', en: 'Product Database' },
    title: { ru: 'Каталог товаров и быстрый импорт', en: 'Catalog Explorer & 1-Click Import' },
    whatIsIt: {
      ru: 'Удобная витрина всех загруженных в систему товаров с фильтрацией по категориям, добавлением новых карточек и загрузкой файлов CSV / Excel / JSON.',
      en: 'Visual explorer for all indexed products with category filtering, manual item creation, and CSV/JSON bulk upload.',
    },
    whyNeeded: {
      ru: 'Чтобы контент-менеджер или SEO-специалист мог в любой момент проверить, как выглядит карточка товара, какие у неё теги, цена и описание, или быстро добавить новый товар и сразу проверить, как он ищется.',
      en: 'Lets content managers inspect product cards, tags, and prices or add new items and test their discoverability immediately.',
    },
    howItWorks: {
      ru: 'При добавлении любого товара (вручную, через файл или из 1С-Битрикс) система сама за долю секунды превращает его название и описание в «смысловой код» (вектор) — никаких сложных настроек делать не нужно.',
      en: 'Every added item is automatically sanitized and converted into a 384-dimensional semantic vector in milliseconds.',
    },
    realExample: {
      ru: 'Пример: Контент-менеджер обновил описание товара, добавил популярные теги — и товар в ту же секунду начинает находиться по новым смысловым запросам.',
      en: 'Example: Add a new product via the form or CSV upload and immediately find it via natural-language search.',
    },
  },
  {
    id: 'abtest',
    emoji: '🧪',
    badge: { ru: 'Проверка гипотез', en: 'Data-Driven Growth' },
    title: { ru: 'A/B Тестирование (Эксперименты без риска)', en: 'A/B Testing Lab (Risk-Free Experiments)' },
    whatIsIt: {
      ru: 'Инструмент, который делит посетителей сайта на группы (например, 50% на 50%) и сравнивает две разные настройки поиска или рекомендаций, автоматически считая, какая из них приносит больше кликов и денег.',
      en: 'Splits traffic between two ranking strategies and calculates statistical significance for CTR, conversion, and revenue.',
    },
    whyNeeded: {
      ru: 'Чтобы маркетолог и директор не спорили на совещании «как лучше настроить каталог», а запустили тест и увидели твёрдые цифры: Вариант Б принёс на +18% больше выручки с достоверностью 99%.',
      en: 'Replaces guesswork with statistical proof before rolling out ranking changes to 100% of shoppers.',
    },
    howItWorks: {
      ru: 'Система сравнивает Контрольную группу (старый алгоритм) и Тестовую группу (новый гибридный алгоритм) и зелёным бейджем подсказывает, когда тест можно завершать и объявлять победителя.',
      en: 'Compares Control vs. Treatment groups and displays a clear confidence badge when a winner is statistically proven.',
    },
    realExample: {
      ru: 'Пример: Вы проверяете гипотезу — «Если поднять в топ товары со скидкой, вырастет ли конверсия из рекламы?». Запускаете A/B-тест и видите точный прирост выручки на каждого посетителя.',
      en: 'Example: Test whether boosting high-margin items increases total revenue per visitor without hurting click-through rate.',
    },
  },
  {
    id: 'conversational',
    emoji: '💬',
    badge: { ru: 'Умный консультант', en: 'AI Shopping Assistant' },
    title: { ru: 'Диалоговый AI-ассистент (Чат-консультант)', en: 'Conversational AI Shopping Assistant' },
    whatIsIt: {
      ru: 'Встроенный онлайн-консультант, которому покупатель может написать человеческим языком любую задачу, и ассистент мгновенно соберёт готовую подборку товаров из вашего каталога.',
      en: 'An interactive chat assistant that understands multi-turn shopper requests and recommends matching catalog items.',
    },
    whyNeeded: {
      ru: 'Многие покупатели (особенно с мобильных телефонов из Instagram/Telegram/ВК) не любят копаться в 50 фильтрах каталога. Им проще написать в чат: «Ищу подарок мужу до 15 тысяч для путешествий» — и сразу получить 3–4 идеальных варианта.',
      en: 'Helps mobile shoppers who prefer asking a question in plain language over clicking through dozens of catalog filters.',
    },
    howItWorks: {
      ru: 'Ассистент выделяет из сообщения клиента бюджет, категорию и пожелания, проверяет наличие товаров в вашей базе и выдаёт карточки, на которые можно сразу кликнуть.',
      en: 'Extracts intent, budget, and preferences from natural dialogue and retrieves verified in-stock items from your index.',
    },
    realExample: {
      ru: 'Пример для SMM: Вы ведёте трафик с рилс/клипов на страницу с AI-подборщиком подарков — вовлечённость и время на сайте вырастают в 2 раза.',
      en: 'Example: Drive social media campaign traffic to an interactive gift-finder assistant to double session engagement.',
    },
  },
  {
    id: 'vectorspace',
    emoji: '🌌',
    badge: { ru: 'Визуальная карта', en: '3D Assortment Map' },
    title: { ru: '3D Векторное пространство (Карта ассортимента)', en: '3D Vector Space (Visual Assortment Map)' },
    whatIsIt: {
      ru: 'Красивая трёхмерная карта всех ваших товаров в виде созвездий, где похожие по смыслу товары располагаются рядом друг с другом.',
      en: 'An interactive 3D galaxy where semantically similar products cluster together in space.',
    },
    whyNeeded: {
      ru: 'Позволяет контент-менеджеру и категорийному менеджеру буквально «увидеть глазами», правильно ли распределены товары по рубрикам и нет ли товаров-одиночек с плохим описанием.',
      en: 'Lets category managers visually spot misclassified items, tight product clusters, or assortment gaps.',
    },
    howItWorks: {
      ru: 'Кликните на любую точку (товар) в 3D-космосе — и зелёные лучи покажут его ближайших соседей, которых система будет рекомендовать покупателям.',
      en: 'Click any node in 3D space to highlight its nearest semantic neighbors and inspect its connections.',
    },
    realExample: {
      ru: 'Пример: Вы видите, что зимняя куртка на карте почему-то улетела в раздел «Обувь». Открываете её карточку и замечаете ошибку в описании, которую допустил поставщик.',
      en: 'Example: Instantly spot an item that drifted into the wrong category cluster due to a supplier description typo.',
    },
  },
  {
    id: 'adaptive',
    emoji: '⚙️',
    badge: { ru: 'Персонализация на лету', en: 'Live Personalization' },
    title: { ru: 'Адаптивный движок (Учёт кликов в реальном времени)', en: 'Adaptive Engine (Real-Time Click Personalization)' },
    whatIsIt: {
      ru: 'Система мгновенной персонализации, которая угадывает вкусы посетителя прямо по ходу его кликов, лайков и просмотров на сайте.',
      en: 'Adapts recommendations in real time with every click, like, purchase, or dislike during a session.',
    },
    whyNeeded: {
      ru: '90% посетителей интернет-магазинов не входят в личный кабинет при первом визите. Адаптивный движок решает проблему «холодного старта»: стоит человеку кликнуть на 2–3 товара, как вся витрина уже перестраивается под его интересы!',
      en: 'Solves the anonymous shopper cold-start problem by learning intent within 2–3 clicks without requiring login.',
    },
    howItWorks: {
      ru: 'Нажимайте кнопки «Клик», «Лайк», «Покупка» или «Не нравится» на карточках — и наблюдайте, как лента рекомендаций мгновенно подтягивает похожие бренды и категории и убирает то, что клиенту не подошло.',
      en: 'Simulate clicks, likes, purchases, or dislikes and watch the recommendation feed recalibrate in under 5 milliseconds.',
    },
    realExample: {
      ru: 'Пример: Покупатель зашёл по общей рекламе, дважды кликнул на беспроводные колонки — и главная страница тут же предлагает ему подборку портативной акустики и чехлов.',
      en: 'Example: A visitor clicks two portable speakers and the homepage immediately personalizes around wireless audio gear.',
    },
  },
  {
    id: 'analytics',
    emoji: '📈',
    badge: { ru: 'Отчёты и скорость', en: 'Reports & Speed' },
    title: { ru: 'Аналитика, тренды и скорость работы (SLA)', en: 'Analytics, Trends & SLA Telemetry' },
    whatIsIt: {
      ru: 'Наглядные графики скорости работы сайта, экономии ресурсов за счёт кэша и распределения интереса покупателей по категориям.',
      en: 'Live charts tracking response times, cache efficiency, and category demand trends.',
    },
    whyNeeded: {
      ru: 'Каждая лишняя секунда загрузки поиска снижает продажи на 7–10%. Здесь видно, что ваш поиск отвечает за 2–5 миллисекунд и выдерживает любые рекламные наплывы.',
      en: 'Proves that search stays under 5–15ms even during heavy promotional traffic spikes.',
    },
    howItWorks: {
      ru: 'Показывает долю мгновенных ответов из быстрой памяти (Cache Hit Rate > 80%), разнообразие показанных товаров и топ растущих категорий.',
      en: 'Displays real-time P50/P95/P99 latency, Redis cache hit ratio, and category growth dynamics.',
    },
    realExample: {
      ru: 'Пример: После запуска крупной рассылки или рекламы у блогера вы открываете «Аналитику» и убеждаетесь, что сайт работает так же мгновенно, как и в обычный день.',
      en: 'Example: Monitor live latency and cache hit rates during an influencer campaign drop.',
    },
  },
  {
    id: 'indexes',
    emoji: '🗄️',
    badge: { ru: 'Экономия памяти до 32x', en: 'Up to 32x RAM Savings' },
    title: { ru: 'Менеджер индексов HNSW (Умное сжатие базы)', en: 'HNSW Index Manager (Memory Quantization)' },
    whatIsIt: {
      ru: 'Панель управления базами товаров, где можно выбрать режим сжатия памяти (FP32, FP16, INT8 или Binary) без потери качества поиска.',
      en: 'Manage vector collections and compare memory compression modes (FP32, FP16, INT8, Binary).',
    },
    whyNeeded: {
      ru: 'Если у вас 100 000 или 1 000 000 товаров, аренда дорогих серверов может бить по карману. Сжатие INT8 уменьшает потребление оперативной памяти ровно в 4 раза, сохраняя 99.4% точности поиска!',
      en: 'Cuts cloud hosting bills by 4× to 32× on large catalogs while keeping over 99% search recall.',
    },
    howItWorks: {
      ru: 'В таблице наглядно показано, сколько мегабайт занимает ваша база в разных режимах, и можно создать отдельный индекс (например, отдельно для товаров и отдельно для статей блога).',
      en: 'Compare RAM usage across quantization modes and create separate indexes for products, articles, or regions.',
    },
    realExample: {
      ru: 'Пример: Вы включаете режим INT8 — и ваш каталог на полмиллиона товаров спокойно работает на самом обычном недорогом сервере.',
      en: 'Example: Enable INT8 quantization to run a 500,000-SKU catalog on an affordable standard VPS.',
    },
  },
  {
    id: 'cluster',
    emoji: '🌐',
    badge: { ru: 'Защита от падений 24/7', en: 'Zero-Downtime HA' },
    title: { ru: 'Кластер и отказоустойчивость (Защита в Чёрную пятницу)', en: 'Cluster & Failover (Black Friday Protection)' },
    whatIsIt: {
      ru: 'Визуальная схема серверов вашего поиска с кнопкой проверки аварийного переключения («Drain / Failover»).',
      en: 'Interactive map of your distributed search shards and read replicas with one-click failover testing.',
    },
    whyNeeded: {
      ru: 'Для бизнеса нет ничего хуже, чем упавший поиск на сайте в разгар распродажи или когда крутится дорогая реклама. Кластер гарантирует: даже если один узел выйдет из строя, его резервная копия (реплика) за долю секунды подхватит работу.',
      en: 'Ensures your store search never goes offline during peak sales, even if a hardware node fails.',
    },
    howItWorks: {
      ru: 'Вы можете прямо на экране нажать кнопку «Тест Failover (Drain)» на любом узле и своими глазами увидеть, как резервная реплика мгновенно становится главной, а сайт продолжает работать без единого сбоя.',
      en: 'Click "Simulate Failover" on any shard to watch a read replica automatically promote to Primary with zero downtime.',
    },
    realExample: {
      ru: 'Пример: Перед новогодней распродажей вы проверяете готовность кластера и видите зелёный статус: все 3 шарда и 6 реплик синхронизированы.',
      en: 'Example: Verify high-availability failover readiness in one click before launching a Black Friday sale.',
    },
  },
  {
    id: 'settings',
    emoji: '🔐',
    badge: { ru: 'Доступы и безопасность', en: 'Access & Security' },
    title: { ru: 'Настройки, роли сотрудников и API-ключи', en: 'Settings, Team Roles & API Keys' },
    whatIsIt: {
      ru: 'Раздел, где настраиваются ключи для подключения к 1С-Битрикс / WooCommerce, права доступа для команды и журнал всех изменений.',
      en: 'Manage API keys for CMS plugins, role-based team permissions, and the immutable audit log.',
    },
    whyNeeded: {
      ru: 'Чтобы каждый сотрудник имел только свой уровень доступа: контент-менеджер или аналитик может смотреть статистику, мерчандайзер — настраивать ползунки акций, а полный доступ есть только у руководителя.',
      en: 'Gives viewers, merchandisers, and admins appropriate permissions while logging every configuration change.',
    },
    howItWorks: {
      ru: 'Здесь же задаются параметры экономии памяти и времени хранения быстрых ответов в кэше, а внизу ведётся автоматическая запись: кто, когда и какую настройку изменил.',
      en: 'Configure default quantization, Redis cache TTL, and inspect the timestamped security audit log.',
    },
    realExample: {
      ru: 'Пример: Вы выдаёте подрядчику по SEO гостевой ключ «Только чтение (Viewer)» — он видит всю аналитику запросов, но не может случайно удалить товары из каталога.',
      en: 'Example: Give an external SEO agency a Read-Only Viewer key so they can analyze search queries safely.',
    },
  },
];
