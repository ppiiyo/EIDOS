export const FAQ_QUESTIONS_DATA: Array<{
  id: string;
  audience: string;
  q: string;
  qRu: string;
  a: string;
  aRu: string;
}> = [
  {
    id: 'q1',
    audience: 'seo',
    q: 'Does EIDOS replace Google for product SEO?',
    qRu: 'Заменяет ли EIDOS Google для SEO товаров?',
    a: 'No. It improves on-site product discovery; organic SEO is separate.',
    aRu: 'Нет. Он улучшает поиск на сайте; органическое SEO — отдельно.',
  },
  {
    id: 'q2',
    audience: 'bitrix',
    q: 'Do I need a programmer to install the Bitrix module?',
    qRu: 'Нужен ли программист для модуля Битрикс?',
    a: 'Module install is standard; point API URL and key in settings, then run sync.',
    aRu: 'Установка стандартная: URL API и ключ в настройках, затем синхронизация.',
  },
  {
    id: 'q3',
    audience: 'sales',
    q: 'Can ranking boost high-margin SKUs?',
    qRu: 'Можно ли поднять высокомаржинальные SKU?',
    a: 'Yes via merchandising rules and business boost fields on catalog items.',
    aRu: 'Да, через правила мерчандайзинга и business-boost поля каталога.',
  },
];
