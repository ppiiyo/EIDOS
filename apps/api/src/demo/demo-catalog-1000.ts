import { CatalogItem, DEMO_CATALOG } from './demo-catalog';
import { mulberry32 } from '../services/seed-catalog';

/**
 * 12 Realistic E-Commerce categories with typical brands, nouns, adjectives, and price ranges
 */
interface CategoryTemplate {
  category: string;
  brands: string[];
  adjectives: string[];
  nouns: Array<{ noun: string; basePrice: number; tags: string[]; icon?: string }>;
}

const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    category: 'Наушники и аудио',
    brands: ['Shokz', 'Sony', 'Apple', 'Sennheiser', 'Bose', 'JBL', 'Soundcore', 'Marshall', 'Beyerdynamic', 'Audio-Technica', 'Nothing'],
    adjectives: ['Спортивные', 'Беспроводные', 'Полноразмерные', 'Внутриканальные', 'Костные', 'Студийные', 'Геймерские', 'Влагозащитные'],
    nouns: [
      { noun: 'наушники для бега с влагозащитой IP67', basePrice: 6990, tags: ['наушники', 'бег', 'спорт', 'блютуз', 'ip67'], icon: '🎧' },
      { noun: 'TWS-наушники с активным шумоподавлением ANC', basePrice: 11990, tags: ['наушники', 'tws', 'anc', 'блютуз'], icon: '🎧' },
      { noun: 'наушники с костной проводимостью для бега и велоспорта', basePrice: 8990, tags: ['наушники', 'костная проводимость', 'бег', 'спорт'], icon: '🎧' },
      { noun: 'мониторные проводные студийные наушники', basePrice: 14990, tags: ['наушники', 'студия', 'звук', 'про'], icon: '🎧' },
      { noun: 'бюджетные беспроводные вкладыши для тренировок', basePrice: 2490, tags: ['наушники', 'бюджетные', 'бег', 'вкладыши'], icon: '🎧' },
      { noun: 'беспроводная игровая гарнитура с микрофоном', basePrice: 7490, tags: ['наушники', 'игры', 'микрофон', 'гарнитура'], icon: '🎧' },
    ],
  },
  {
    category: 'Смартфоны и гаджеты',
    brands: ['Apple', 'Samsung', 'Xiaomi', 'Realme', 'Google', 'OnePlus', 'Poco', 'Infinix', 'Huawei', 'Honor'],
    adjectives: ['Флагманский', 'Бюджетный', 'Игровой', 'Компактный', 'Детский', 'Ультратонкий', 'Ударопрочный'],
    nouns: [
      { noun: 'смартфон 128GB 8-ядерный с быстрой зарядкой', basePrice: 13990, tags: ['смартфон', 'телефон', 'бюджетный', 'android'], icon: '📱' },
      { noun: 'детский смартфон для школьника с родительским контролем', basePrice: 10990, tags: ['смартфон', 'детский', 'телефон', 'школа'], icon: '📱' },
      { noun: 'камерофон с оптической стабилизацией 108МП', basePrice: 34990, tags: ['смартфон', 'камера', 'фото', 'телефон'], icon: '📱' },
      { noun: 'детские смарт-часы с кнопкой SOS и GPS трекером', basePrice: 3490, tags: ['детские', 'часы', 'gps', 'трекер'], icon: '⌚' },
      { noun: 'смартфон до 15000 с емким аккумулятором 5000 мАч', basePrice: 12490, tags: ['смартфон', 'до 15000', 'телефон', 'аккумулятор'], icon: '📱' },
      { noun: 'флагманский смартфон AMOLED 120Hz 256GB', basePrice: 59900, tags: ['смартфон', 'флагман', 'премиум', 'amoled'], icon: '📱' },
    ],
  },
  {
    category: 'Обувь и кроссовки',
    brands: ['Nike', 'Asics', 'Hoka', 'Adidas', 'Salomon', 'Saucony', 'New Balance', 'Puma', 'Mizuno', 'Geox', 'Reima'],
    adjectives: ['Беговые', 'Амортизирующие', 'Трейловые', 'Детские', 'Марафонские', 'Карбоновые', 'Дышащие', 'Утепленные'],
    nouns: [
      { noun: 'кроссовки для бега по асфальту и стадиону', basePrice: 8990, tags: ['кроссовки', 'бег', 'обувь', 'спорт'], icon: '👟' },
      { noun: 'детские кроссовки для бега и школы на липучках', basePrice: 4290, tags: ['кроссовки', 'детские', 'бег', 'обувь'], icon: '👟' },
      { noun: 'марафонские кроссовки с карбоновой пластиной', basePrice: 18990, tags: ['кроссовки', 'марафон', 'бег', 'карбон'], icon: '👟' },
      { noun: 'мембранные кроссовки для трейлраннинга Gore-Tex', basePrice: 13990, tags: ['кроссовки', 'трейл', 'бег', 'мембрана'], icon: '👟' },
      { noun: 'повседневные городские кеды из натуральной замши', basePrice: 6490, tags: ['кроссовки', 'кеды', 'город', 'обувь'], icon: '👟' },
      { noun: 'спортивные сандалии для активного отдыха', basePrice: 4990, tags: ['обувь', 'спорт', 'лето', 'активный отдых'], icon: '👟' },
    ],
  },
  {
    category: 'Автотовары и масла',
    brands: ['Motul', 'Mobil', 'Лукойл', 'Shell', 'Castrol', 'Liqui Moly', 'ZIC', 'Idemitsu', 'Sintec', 'Mann-Filter', 'Bosch'],
    adjectives: ['Синтетическое', 'Всесезонное', 'Высокотехнологичное', 'Оригинальное', 'Премиальное', 'Энергосберегающее'],
    nouns: [
      { noun: 'моторное масло 5W-40 4л для бензиновых и дизельных двигателей', basePrice: 3890, tags: ['масло', '5w-40', '5w40', 'моторное', 'авто'], icon: '🛢️' },
      { noun: 'синтетическое моторное масло 5W-30 4л API SP / ILSAC GF-6', basePrice: 4190, tags: ['масло', '5w-30', '5w30', 'моторное', 'авто'], icon: '🛢️' },
      { noun: 'синтетическое моторное масло 5W-40 1л для доливки', basePrice: 1190, tags: ['масло', '5w-40', '5w40', 'доливка', '1л'], icon: '🛢️' },
      { noun: 'антифриз карбоксилатный G12+ готовый 5 кг', basePrice: 1290, tags: ['автохимия', 'антифриз', 'g12', 'охлаждение'], icon: '🧴' },
      { noun: 'очиститель топливной системы и инжекторов', basePrice: 690, tags: ['автохимия', 'присадка', 'инжектор', 'топливо'], icon: '🧴' },
      { noun: 'масляный фильтр тонкой очистки двигателя', basePrice: 790, tags: ['фильтр', 'масляный', 'автозапчасти', 'то'], icon: '⚙️' },
    ],
  },
  {
    category: 'Ноутбуки и компьютеры',
    brands: ['Apple', 'Lenovo', 'ASUS', 'Dell', 'HP', 'Acer', 'MSI', 'Huawei', 'Honor', 'Xiaomi'],
    adjectives: ['Игровой', 'Тонкий', 'Ультралегкий', 'Мощный', 'Бизнес', 'Профессиональный', 'Студенческий'],
    nouns: [
      { noun: 'ультрабук 14" IPS Core i5 16GB SSD 512GB', basePrice: 59990, tags: ['ноутбук', 'ультрабук', 'офис', 'i5'], icon: '💻' },
      { noun: 'игровой ноутбук 15.6" 144Hz RTX 4060 Ryzen 7', basePrice: 94990, tags: ['ноутбук', 'игровой', 'rtx', 'гейминг'], icon: '💻' },
      { noun: 'ноутбук для учебы и программирования 16" 16GB', basePrice: 44990, tags: ['ноутбук', 'учеба', 'студент', 'код'], icon: '💻' },
      { noun: 'компактный мини-ПК Ryzen 5 32GB NVMe 1TB', basePrice: 38990, tags: ['компьютер', 'мини-пк', 'офис', 'пк'], icon: '🖥️' },
      { noun: 'монитор 27" 2K QHD 165Hz Fast IPS', basePrice: 22990, tags: ['монитор', 'экран', '2k', '165hz'], icon: '🖥️' },
    ],
  },
  {
    category: 'Детские товары',
    brands: ['LEGO', 'Cybex', 'Fisher-Price', 'Brio', 'Micro', 'Reima', 'Happy Baby', 'Chicco', 'Полесье', 'Zuru'],
    adjectives: ['Развивающий', 'Безопасный', 'Детский', 'Обучающий', 'Интерактивный', 'Деревянный', 'Музыкальный'],
    nouns: [
      { noun: 'детский развивающий конструктор для сборки моделей', basePrice: 2990, tags: ['детские', 'конструктор', 'игрушки', 'развитие'], icon: '🧸' },
      { noun: 'детская прогулочная коляска-трость легкая', basePrice: 12990, tags: ['детские', 'коляска', 'прогулка', 'малыш'], icon: '👶' },
      { noun: 'детский самокат трехколесный со светящимися колесами', basePrice: 3990, tags: ['детские', 'самокат', 'спорт', 'дети'], icon: '🛴' },
      { noun: 'деревянная развивающая железная дорога с паровозиком', basePrice: 4590, tags: ['детские', 'деревянные игрушки', 'поезд', 'железная дорога'], icon: '🚂' },
      { noun: 'интерактивный детский робот с голосовым управлением', basePrice: 3490, tags: ['детские', 'робот', 'игрушки', 'stem'], icon: '🤖' },
      { noun: 'детский стульчик для кормления трансформер', basePrice: 6990, tags: ['детские', 'стульчик', 'кормление', 'малыш'], icon: '🪑' },
    ],
  },
  {
    category: 'Книги и литература',
    brands: ['Альпина', 'МИФ', 'Питер', 'Эксмо', 'АСТ', 'O’Reilly', 'Ad Marginem', 'Вильямс'],
    adjectives: ['Фундаментальное', 'Практическое', 'Иллюстрированное', 'Подарочное', 'Полное', 'Классическое'],
    nouns: [
      { noun: 'руководство по алгоритмам и структурам данных', basePrice: 1290, tags: ['книги', 'программирование', 'алгоритмы', 'it'], icon: '📚' },
      { noun: 'детские иллюстрированные сказки и приключения в стихах', basePrice: 690, tags: ['книги', 'детские', 'сказки', 'чтение'], icon: '📖' },
      { noun: 'книга по системной архитектуре и микросервисам', basePrice: 1890, tags: ['книги', 'архитектура', 'разработка', 'бэкенд'], icon: '📚' },
      { noun: 'бестселлер по практической психологии и привычкам', basePrice: 890, tags: ['книги', 'психология', 'саморазвитие', 'бизнес'], icon: '📚' },
      { noun: 'научно-фантастический роман о колонизации Марса', basePrice: 790, tags: ['книги', 'фантастика', 'космос', 'роман'], icon: '🚀' },
    ],
  },
  {
    category: 'Телевизоры и медиа',
    brands: ['LG', 'Samsung', 'Sony', 'TCL', 'Hisense', 'Philips', 'Xiaomi', 'Sonos', 'JBL', 'Apple'],
    adjectives: ['Смарт', 'Ультрачеткий', 'Безрамочный', 'Кинематографичный', 'Голосовой', 'Игровой'],
    nouns: [
      { noun: 'телевизор 55" 4K Ultra HD Smart TV Google TV', basePrice: 36990, tags: ['телевизор', '4k', 'smart tv', 'медиа'], icon: '📺' },
      { noun: 'телевизор 65" OLED 120Hz Dolby Vision & Atmos', basePrice: 119900, tags: ['телевизор', 'oled', '65 дюймов', 'кино'], icon: '📺' },
      { noun: 'саундбар 3.1 с беспроводным сабвуфером Bluetooth', basePrice: 19990, tags: ['саундбар', 'звук', 'аудио', 'кинотеатр'], icon: '🔊' },
      { noun: 'медиаплеер приставка 4K HDR с голосовым пультом', basePrice: 5990, tags: ['приставка', 'смарт тв', 'медиа', '4k'], icon: '📻' },
      { noun: 'портативный Full HD проектор со встроенным аккумулятором', basePrice: 28990, tags: ['проектор', 'кино', 'портативный', 'видео'], icon: '📽️' },
    ],
  },
  {
    category: 'Бытовая техника',
    brands: ['DeLonghi', 'Roborock', 'Bosch', 'Philips', 'Dyson', 'Kitfort', 'Redmond', 'Tefal', 'Braun', 'Dreame'],
    adjectives: ['Автоматическая', 'Роботизированный', 'Погружной', 'Беспроводной', 'Интеллектуальный', 'Эргономичный'],
    nouns: [
      { noun: 'автоматическая кофемашина эспрессо с капучинатором', basePrice: 32990, tags: ['бытовая техника', 'кофемашина', 'кофе', 'эспрессо'], icon: '☕' },
      { noun: 'робот-пылесос с влажной уборкой и лазерной навигацией LiDAR', basePrice: 26990, tags: ['бытовая техника', 'робот-пылесос', 'уборка', 'умный дом'], icon: '🤖' },
      { noun: 'беспроводной вертикальный пылесос с циклоном', basePrice: 18990, tags: ['бытовая техника', 'пылесос', 'уборка', 'аккумулятор'], icon: '🧹' },
      { noun: 'погружной блендер с венчиком и измельчителем 1000 Вт', basePrice: 3990, tags: ['бытовая техника', 'блендер', 'кухня', 'готовка'], icon: '🥣' },
      { noun: 'электрический чайник с выбором температуры воды', basePrice: 2890, tags: ['бытовая техника', 'чайник', 'кухня', 'чай'], icon: '🫖' },
    ],
  },
  {
    category: 'Одежда и экипировка',
    brands: ['Salomon', 'The North Face', 'Craft', 'Nike', 'Under Armour', 'Columbia', 'Buff', 'Helly Hansen', 'Fischer'],
    adjectives: ['Ветрозащитная', 'Мембранная', 'Терморегулирующая', 'Спортивная', 'Дышащая', 'Влагоотводящая'],
    nouns: [
      { noun: 'ветрозащитная беговая куртка с капюшоном', basePrice: 7990, tags: ['одежда', 'бег', 'куртка', 'спорт', 'экипировка'], icon: '🧥' },
      { noun: 'спортивные беговые тайтсы с карманом для телефона', basePrice: 4490, tags: ['одежда', 'бег', 'тайтсы', 'спорт'], icon: '👖' },
      { noun: 'комплект термобелья для бега и активного спорта зимой', basePrice: 5990, tags: ['термобелье', 'бег', 'зима', 'спорт'], icon: '🩱' },
      { noun: 'быстросохнущая спортивная футболка для бега', basePrice: 2290, tags: ['одежда', 'футболка', 'бег', 'спорт'], icon: '👕' },
      { noun: 'беговая кепка с защитой от ультрафиолета UPF50', basePrice: 1890, tags: ['аксессуары', 'кепка', 'бег', 'лето'], icon: '🧢' },
    ],
  },
  {
    category: 'Спортивные товары',
    brands: ['Polar', 'Garmin', 'Manduka', 'Gladiator', 'Torneo', 'Aonijie', 'Demix', 'Kettler', 'Decathlon'],
    adjectives: ['Профессиональный', 'Нагрудный', 'Компактный', 'Регулируемый', 'Складной', 'Скоростной'],
    nouns: [
      { noun: 'нагрудный пульсометр для бега Bluetooth & ANT+', basePrice: 7490, tags: ['спорт', 'бег', 'пульсометр', 'тренировки'], icon: '❤️' },
      { noun: 'беговой жилет-рюкзак с мягкими флягами для марафона', basePrice: 4990, tags: ['спорт', 'бег', 'жилет', 'гидратор', 'марафон'], icon: '🎒' },
      { noun: 'набор разборных гантелей в кейсе 20 кг', basePrice: 6990, tags: ['спорт', 'фитнес', 'гантели', 'силовые'], icon: '🏋️' },
      { noun: 'нескользящий профессиональный коврик для йоги и растяжки', basePrice: 3290, tags: ['спорт', 'йога', 'коврик', 'фитнес'], icon: '🧘' },
      { noun: 'скоростная скакалка на подшипниках для кроссфита', basePrice: 1190, tags: ['спорт', 'скакалка', 'кроссфит', 'кардио'], icon: '⚡' },
    ],
  },
  {
    category: 'Инструменты и ремонт',
    brands: ['DeWalt', 'Bosch', 'Makita', 'Metabo', 'Jonnesway', 'ADA', 'Wera', 'Knipex', 'Зубр', 'Интерскол'],
    adjectives: ['Аккумуляторный', 'Бесщеточный', 'Лазерный', 'Профессиональный', 'Ударный', 'Универсальный'],
    nouns: [
      { noun: 'аккумуляторный бесщеточный шуруповерт 18V Li-Ion', basePrice: 9990, tags: ['инструменты', 'шуруповерт', 'аккумулятор', 'ремонт'], icon: '🪛' },
      { noun: 'самовыравнивающийся лазерный уровень 3D 360 градусов', basePrice: 6490, tags: ['инструменты', 'лазер', 'уровень', 'строительство'], icon: '📏' },
      { noun: 'набор слесарного инструмента 94 предмета в ударопрочном кейсе', basePrice: 7990, tags: ['инструменты', 'набор', 'автодело', 'ключи'], icon: '🧰' },
      { noun: 'сетевой перфоратор SDS-plus 800 Вт с реверсом', basePrice: 8490, tags: ['инструменты', 'перфоратор', 'бетон', 'бурение'], icon: '🔨' },
      { noun: 'компактная угловая шлифмашина болгарка 125 мм', basePrice: 4490, tags: ['инструменты', 'болгарка', 'ушм', 'металл'], icon: '⚙️' },
    ],
  },
];

/**
 * Generates deterministic 1000+ SKU demo catalog.
 * Starts with original 48 items from DEMO_CATALOG (ensuring 100% backward compat),
 * followed by 1,000 realistic e-commerce items.
 */
export function buildDemoCatalog1000(targetTotal: number = 1048): CatalogItem[] {
  const items: CatalogItem[] = [...DEMO_CATALOG];
  const prng = mulberry32(1337);

  const needed = Math.max(0, targetTotal - DEMO_CATALOG.length);
  let globalIndex = 0;

  while (items.length < targetTotal) {
    for (let cIdx = 0; cIdx < CATEGORY_TEMPLATES.length && items.length < targetTotal; cIdx++) {
      const cat = CATEGORY_TEMPLATES[cIdx];
      const brand = cat.brands[Math.floor(prng() * cat.brands.length)];
      const adj = cat.adjectives[Math.floor(prng() * cat.adjectives.length)];
      const nounObj = cat.nouns[Math.floor(prng() * cat.nouns.length)];

      const itemNum = globalIndex + 101;
      const id = `sku-ecom-${String(itemNum).padStart(5, '0')}`;

      // Realistic price fluctuation (-20% to +40%)
      const priceMultiplier = 0.8 + prng() * 0.6;
      const price = Math.round((nounObj.basePrice * priceMultiplier) / 10) * 10;

      const rating = Math.round((4.0 + prng() * 0.95) * 10) / 10;
      const reviews = Math.floor(prng() * 1200) + 12;

      const badges = ['Хит', 'Выбор покупателей', 'Скидка', 'Новинка', 'Премиум', undefined];
      const badge = badges[Math.floor(prng() * badges.length)];

      const title = `${adj} ${nounObj.noun.split(' ')[0]} ${brand} ${nounObj.noun.split(' ').slice(1).join(' ')}`;
      const description = `${brand}: ${nounObj.noun}. Высокое качество, официальная гарантия производителя, быстрая доставка. SKU #${id}.`;

      const tags = Array.from(new Set([
        ...nounObj.tags,
        brand.toLowerCase(),
        adj.toLowerCase(),
        cat.category.toLowerCase().split(' ')[0],
      ]));

      items.push({
        id,
        title,
        description,
        category: cat.category,
        price,
        inStock: prng() > 0.05, // 95% in stock
        tags,
        rating,
        reviews,
        badge,
        icon: nounObj.icon,
      });

      globalIndex++;
    }
  }

  return items;
}

export const DEMO_CATALOG_1000 = buildDemoCatalog1000(1048);
