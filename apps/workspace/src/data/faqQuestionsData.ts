import type { FaqAudienceId } from './faqGuideData';

type LangText = { ru: string; en: string };
type LangSteps = { ru: string[]; en: string[] };

export interface FaqQuestionItem {
  id: string;
  audience: FaqAudienceId;
  roleBadge: LangText;
  question: LangText;
  shortAnswer: LangText;
  detailedSteps: LangSteps;
  businessImpact: LangText;
  relatedView?: string;
}

export const FAQ_QUESTIONS_DATA: FaqQuestionItem[] = [
  {
    id: 'q1',
    audience: 'seo',
    roleBadge: { ru: 'SEO', en: 'SEO' },
    question: {
      ru: 'Заменяет ли EIDOS Google для SEO товаров?',
      en: 'Does EIDOS replace Google for product SEO?',
    },
    shortAnswer: {
      ru: 'Нет. Улучшает поиск на сайте; органическое SEO отдельно.',
      en: 'No. It improves on-site discovery; organic SEO is separate.',
    },
    detailedSteps: {
      ru: [
        'Индексируйте каталог в EIDOS для витрины',
        'Сохраняйте классические SEO-страницы и сниппеты',
        'Смотрите zero-result запросы в аналитике',
      ],
      en: [
        'Index the catalog in EIDOS for the storefront',
        'Keep classic SEO pages and snippets',
        'Watch zero-result queries in analytics',
      ],
    },
    businessImpact: {
      ru: 'Меньше «пустых» поисков на сайте → выше конверсия.',
      en: 'Fewer empty on-site searches → higher conversion.',
    },
    relatedView: 'search',
  },
  {
    id: 'q2',
    audience: 'bitrix',
    roleBadge: { ru: 'Битрикс', en: 'Bitrix' },
    question: {
      ru: 'Нужен ли программист для модуля Битрикс?',
      en: 'Do I need a developer for the Bitrix module?',
    },
    shortAnswer: {
      ru: 'Установка стандартная: URL API, ключ, синхронизация.',
      en: 'Standard install: API URL, key, then sync.',
    },
    detailedSteps: {
      ru: [
        'Установите модуль eidos.connector',
        'Укажите base URL и search-ключ',
        'Запустите полную синхронизацию и cron',
      ],
      en: [
        'Install the eidos.connector module',
        'Set base URL and search key',
        'Run full sync and enable cron',
      ],
    },
    businessImpact: {
      ru: 'Пилот на витрине за часы, не недели.',
      en: 'Storefront pilot in hours, not weeks.',
    },
    relatedView: 'integrations',
  },
  {
    id: 'q3',
    audience: 'sales',
    roleBadge: { ru: 'Продажи', en: 'Sales' },
    question: {
      ru: 'Можно ли поднять высокомаржинальные SKU?',
      en: 'Can ranking boost high-margin SKUs?',
    },
    shortAnswer: {
      ru: 'Да — через merchandising rules и business boost.',
      en: 'Yes — via merchandising rules and business boost.',
    },
    detailedSteps: {
      ru: [
        'Пометьте приоритетные SKU в каталоге',
        'Настройте веса в Studio / Admin',
        'Проверьте X-Ray по выдаче',
      ],
      en: [
        'Mark priority SKUs in the catalog',
        'Tune weights in Studio / Admin',
        'Verify with X-Ray on results',
      ],
    },
    businessImpact: {
      ru: 'Рост среднего чека без потери релевантности.',
      en: 'Higher AOV without losing relevance.',
    },
    relatedView: 'dashboard',
  },
];
