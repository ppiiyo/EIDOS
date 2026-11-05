import { CatalogItem, DEMO_CATALOG } from './demo-catalog';
import { mulberry32 } from '../services/seed-catalog';

interface ProductSeries {
  category: string;
  prefix: string;
  brand: string;
  models: string[];
  variants: string[];
  specs: string[];
  basePrice: number;
  tags: string[];
  icon: string;
}

const PRODUCT_CATALOG_SERIES: ProductSeries[] = [
  // 1. Наушники и аудио (беговые, TWS, полноразмерные, студийные)
  {
    category: 'Наушники и аудио',
    prefix: 'Спортивные наушники для бега',
    brand: 'Shokz',
    models: ['OpenRun Pro S810', 'OpenRun Mini S803', 'OpenMove S661', 'OpenSwim S700', 'OpenFit T910'],
    variants: ['Black', 'Midnight Blue', 'Slate Grey', 'Beige', 'Sunset Red'],
    specs: [
      'костная проводимость, Bluetooth 5.1, защита от пота IP55, до 10 ч работы, вес 29 г',
      'открытая посадка для безопасного бега в городе, быстрая зарядка, титановая дужка',
      'надёжная фиксация при марафоне и велотренировках, сдвоенный микрофон с шумоподавлением',
    ],
    basePrice: 8990,
    tags: ['наушники', 'бег', 'спорт', 'костная проводимость', 'bluetooth', 'shokz', 'wireless', 'headphones'],
    icon: '🎧',
  },
  {
    category: 'Наушники и аудио',
    prefix: 'Беспроводные наушники для бега',
    brand: 'JBL',
    models: ['Endurance Peak 3', 'Endurance Race TWS', 'Reflect Aero TWS', 'Sprint Run BT', 'Endurance Run 2 Wireless'],
    variants: ['Black', 'Blue Coral', 'Mint', 'White', 'Red'],
    specs: [
      'крепление PowerHook с заушиной, защита от воды и пыли, до 30 ч с кейсом, глубокий бас',
      'технология TwistLock (не выпадают на пробежке), режим Ambient Aware для слышимости улицы',
      'лёгкие спортивные вкладыши для фитнеса и утреннего бега, быстрая зарядка 10 мин = 2 ч',
    ],
    basePrice: 4490,
    tags: ['наушники', 'бег', 'спорт', 'недорогие', 'вкладыши', 'jbl', 'tws', 'wireless', 'headphones'],
    icon: '🎧',
  },
  {
    category: 'Наушники и аудио',
    prefix: 'Беспроводные спортивные наушники',
    brand: 'Soundcore',
    models: ['Sport X10', 'Life P3i', 'Space A40', 'Liberty 4 NC', 'AeroFit'],
    variants: ['Obsidian Black', 'Oat White', 'Navy Blue', 'Crimson Red', 'Frost Blue'],
    specs: [
      'поворотные заушины 210° для бега и зала, технология BassUp, 6 микрофонов для звонков',
      'компактные TWS-наушники с гибридным ANC, Bluetooth 5.3, приложение с эквалайзером',
      'защита от пота SweatGuard, анатомическая посадка для интенсивных кардиотренировок',
    ],
    basePrice: 3690,
    tags: ['наушники', 'бег', 'спорт', 'недорогие', 'бюджетные', 'soundcore', 'bluetooth', 'wireless', 'headphones'],
    icon: '🎧',
  },
  {
    category: 'Наушники и аудио',
    prefix: 'Полноразмерные беспроводные наушники',
    brand: 'Sony',
    models: ['WH-1000XM5', 'WH-1000XM4', 'WH-CH720N', 'WH-CH520', 'ULT Wear WH-ULT900N'],
    variants: ['Black', 'Platinum Silver', 'Midnight Blue', 'Cream', 'Forest Gray'],
    specs: [
      'интеллектуальное шумоподавление ANC, кодек LDAC Hi-Res Audio, до 30 часов автономности',
      'мультипоинт на 2 устройства, мягкие амбушюры из экокожи, кристально чистая передача речи',
      '30-мм динамики с карбоновым куполом, сенсорное управление, складной кейс в комплекте',
    ],
    basePrice: 16990,
    tags: ['наушники', 'аудио', 'шумоподавление', 'anc', 'bluetooth', 'sony'],
    icon: '🎧',
  },
  {
    category: 'Наушники и аудио',
    prefix: 'Внутриканальные TWS-наушники',
    brand: 'Sennheiser',
    models: ['Momentum True Wireless 4', 'Accentum True Wireless', 'CX Plus True Wireless', 'Sport True Wireless'],
    variants: ['Black Copper', 'White Silver', 'Graphite', 'Black'],
    specs: [
      'фирменные излучатели TrueResponse 7 мм, поддержка aptX Adaptive, адаптивный шумодав',
      'акустические сменные адаптеры для бега и тренировок, плотная посадка в ушной раковине',
      'беспроводная зарядка Qi, режим прозрачности Anti-Wind, настройка звука Sound Check',
    ],
    basePrice: 14490,
    tags: ['наушники', 'tws', 'аудио', 'sennheiser', 'звук', 'бег'],
    icon: '🎧',
  },
  {
    category: 'Наушники и аудио',
    prefix: 'Студийные мониторные наушники',
    brand: 'Beyerdynamic',
    models: ['DT 770 PRO 80 Ohm', 'DT 990 PRO 250 Ohm', 'DT 700 PRO X', 'DT 900 PRO X', 'MMX 150'],
    variants: ['Black Studio', 'Grey Edition', 'Limited Black'],
    specs: [
      'закрытое акустическое оформление, велюровые сменные амбушюры, витой кабель 3 м, сборка Германия',
      'ровная АЧХ для сведения и мониторинга звука, стальное оголовье, переходник Jack 6.3 мм',
    ],
    basePrice: 15990,
    tags: ['наушники', 'студийные', 'мониторные', 'проводные', 'звук', 'beyerdynamic'],
    icon: '🎧',
  },

  // 2. Смартфоны и гаджеты (включая детские до 15000 и флагманы)
  {
    category: 'Смартфоны и гаджеты',
    prefix: 'Детский смартфон',
    brand: 'Xiaomi',
    models: ['Redmi 13C', 'Redmi A3', 'Redmi 12', 'Redmi Note 12', 'Poco C65'],
    variants: ['4/128GB Ocean Blue', '4/128GB Mint Green', '6/128GB Midnight Black', '4/64GB Star Blue', '6/128GB Purple'],
    specs: [
      'компактный смартфон для школьника до 15000 ₽, настроенный родительский контроль Google Family Link, батарея 5000 мАч',
      'IPS-экран 6.74" 90 Гц с защитой зрения TÜV, прочный корпус, NFC для оплаты проезда, чехол в комплекте',
      'надёжный детский телефон для связи и учёбы, громкий динамик, сканер отпечатка в кнопке, слот на 2 SIM',
    ],
    basePrice: 9990,
    tags: ['смартфон', 'детский', 'телефон', 'до 15000', 'недорогие', 'школа', 'xiaomi'],
    icon: '📱',
  },
  {
    category: 'Смартфоны и гаджеты',
    prefix: 'Смартфон для ребёнка',
    brand: 'Realme',
    models: ['Note 50', 'C61', 'C53', 'C51', 'Narzo N53'],
    variants: ['4/128GB Sky Blue', '4/64GB Midnight Black', '6/128GB Champion Gold', '4/128GB Mint Green'],
    specs: [
      'бюджетный детский смартфон до 15000 руб с контролем экранного времени и геолокацией ребёнка',
      'тонкий корпус 7.99 мм, влагозащита IP54, аккумулятор 5000 мАч (до 2 дней без подзарядки в школе)',
    ],
    basePrice: 8490,
    tags: ['смартфон', 'детский', 'телефон', 'до 15000', 'бюджетный', 'realme'],
    icon: '📱',
  },
  {
    category: 'Смартфоны и гаджеты',
    prefix: 'Смартфон',
    brand: 'Samsung',
    models: ['Galaxy A15', 'Galaxy A25 5G', 'Galaxy A35 5G', 'Galaxy A55 5G', 'Galaxy S24', 'Galaxy S24 Ultra'],
    variants: ['6/128GB Тёмно-синий', '8/256GB Голубой лёд', '8/128GB Лавандовый', '12/256GB Серый титан', '8/256GB Графит'],
    specs: [
      'дисплей Super AMOLED 120 Гц, тройная камера 50 МП с оптической стабилизацией OIS, модуль NFC',
      'защита от воды IP67, стереодинамики Dolby Atmos, поддержка быстрой зарядки 25 Вт',
    ],
    basePrice: 24990,
    tags: ['смартфон', 'телефон', 'samsung', 'galaxy', 'amoled', 'камера'],
    icon: '📱',
  },
  {
    category: 'Смартфоны и гаджеты',
    prefix: 'Смартфон',
    brand: 'Apple',
    models: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max'],
    variants: ['128GB Midnight', '128GB Blue', '256GB Black Titanium', '256GB Natural Titanium', '128GB Starlight', '256GB Pink'],
    specs: [
      'дисплей Super Retina XDR OLED, процессор Apple Bionic, защита Ceramic Shield, порт USB Type-C',
      'система камер 48 МП с 2-кратным телеобъективом, кинематографический режим видео 4K HDR, Face ID',
    ],
    basePrice: 69990,
    tags: ['смартфон', 'айфон', 'iphone', 'apple', 'телефон', 'флагман'],
    icon: '📱',
  },
  {
    category: 'Смартфоны и гаджеты',
    prefix: 'Детские умные часы с GPS',
    brand: 'Geozon',
    models: ['4G Plus', 'Aqua LTE', 'Kid Watch Pro', 'Neo GPS', 'Junior Call'],
    variants: ['Синий', 'Розовый', 'Бирюзовый', 'Чёрно-зелёный'],
    specs: [
      'точное определение геопозиции ребёнка по GPS/ГЛОНАСС/Wi-Fi, видеозвонки 4G, кнопка экстренного вызова SOS',
      'водонепроницаемый корпус IP67, контроль безопасных геозон (школа/дом), шагомер и расписание уроков',
    ],
    basePrice: 4290,
    tags: ['детские', 'часы', 'смарт-часы', 'gps', 'школа'],
    icon: '⌚',
  },

  // 3. Обувь и кроссовки (беговые, трейл, детские — ловушка для Category Gate)
  {
    category: 'Обувь и кроссовки',
    prefix: 'Беговые кроссовки',
    brand: 'Asics',
    models: ['Gel-Kayano 30', 'Novablast 4', 'Gel-Nimbus 26', 'GT-2000 12', 'Gel-Cumulus 25', 'Gel-Pulse 15'],
    variants: ['мужские, р. 41', 'мужские, р. 42.5', 'мужские, р. 43', 'мужские, р. 44', 'женские, р. 38', 'женские, р. 39'],
    specs: [
      'кроссовки для бега по асфальту и беговой дорожке, пена FF BLAST PLUS ECO, гелевая вставка PureGEL в пятке',
      'дышащая жаккардовая сетка, стабилизация стопы 4D GUIDANCE SYSTEM, износостойкая подмётка AHAR+',
    ],
    basePrice: 12990,
    tags: ['кроссовки', 'бег', 'обувь', 'спорт', 'марафон', 'asics'],
    icon: '👟',
  },
  {
    category: 'Обувь и кроссовки',
    prefix: 'Кроссовки для бега',
    brand: 'Nike',
    models: ['Pegasus 40', 'Vomero 17', 'Winflo 10', 'Revolution 7', 'Downshifter 13', 'Structure 25'],
    variants: ['Black/White, р. 42', 'Volt Green, р. 43', 'Navy Blue, р. 41', 'Grey Fog, р. 38.5', 'Crimson, р. 44'],
    specs: [
      'упругая амортизация Nike React + две подушки Zoom Air, вафельный протектор для сцепления с мокрым асфальтом',
      'лёгкие беговые кроссовки для ежедневных тренировок и полумарафона, вентиляционная сетка Engineered Mesh',
    ],
    basePrice: 9490,
    tags: ['кроссовки', 'бег', 'обувь', 'спорт', 'nike'],
    icon: '👟',
  },
  {
    category: 'Обувь и кроссовки',
    prefix: 'Кроссовки для трейлраннинга и бега',
    brand: 'Salomon',
    models: ['Speedcross 6', 'Sense Ride 5', 'Ultra Glide 2', 'Pulsar Trail', 'Alphacross 5 GTX'],
    variants: ['GORE-TEX Black, р. 42', 'Deep Lake, р. 43', 'Fiery Red, р. 44', 'Olive Night, р. 41', 'Slate, р. 39'],
    specs: [
      'агрессивный протектор Mud Contagrip 5 мм для бега по пересечённой местности и лесным тропам, быстрая шнуровка Quicklace',
      'водонепроницаемая мембрана Gore-Tex, защита мыска от камней и корней, посадка SensiFit',
    ],
    basePrice: 13490,
    tags: ['кроссовки', 'бег', 'трейл', 'обувь', 'мембрана', 'salomon'],
    icon: '👟',
  },
  {
    category: 'Обувь и кроссовки',
    prefix: 'Детские кроссовки для бега и физкультуры',
    brand: 'Adidas',
    models: ['Runfalcon 3.0 K', 'Tensaur Run 2.0 Kids', 'Duramo SL Kids', 'FortaRun 2.0', 'Eq21 Run Kids'],
    variants: ['р. 31, синие', 'р. 32, чёрно-белые', 'р. 33, красные', 'р. 34, серые', 'р. 35, зелёные', 'р. 30, розовые'],
    specs: [
      'лёгкие детские кроссовки на липучке и эластичных шнурках, немаркая подошва Non-Marking для школьного спортзала',
      'амортизирующая промежуточная подошва Cloudfoam, усиленный носок, дышащий текстильный верх',
    ],
    basePrice: 3990,
    tags: ['кроссовки', 'детские', 'бег', 'обувь', 'школа', 'adidas'],
    icon: '👟',
  },

  // 4. Автотовары и масла (5W-40, 5W-30, фильтры)
  {
    category: 'Автотовары и масла',
    prefix: 'Моторное масло',
    brand: 'Лукойл',
    models: [
      'Genesis Armortech 5W-40 синтетическое',
      'Люкс Синтетическое 5W-40 API SN/CF',
      'Genesis Armortech FD 5W-30 синтетическое',
      'Genesis Armortech GC 5W-30 для VAG',
      'Genesis Universal 5W-40 полусинтетическое',
    ],
    variants: ['канистра 4 л', 'канистра 1 л (на доливку)', 'канистра 5 л', 'набор 4 л + 1 л'],
    specs: [
      'всесезонное синтетическое моторное масло 5W-40 для бензиновых и дизельных двигателей, допуски MB 229.5, VW 502.00/505.00, Renault RN 0700/0710',
      'технология DuraMax, уверенный холодный пуск зимой до -40 °C, защита турбированных моторов от нагара и износа',
    ],
    basePrice: 2890,
    tags: ['масло', 'моторное масло', '5w-40', '5w40', 'автотовары', 'лукойл'],
    icon: '🛢️',
  },
  {
    category: 'Автотовары и масла',
    prefix: 'Синтетическое моторное масло',
    brand: 'Motul',
    models: [
      '8100 X-cess Gen2 5W-40',
      '8100 X-clean EFE 5W-30',
      '6100 Synergie+ 5W-40',
      'Specific 504 00 507 00 5W-30',
      '8100 Eco-lite 5W-30 API SP',
    ],
    variants: ['4 л', '5 л', '1 л', '2 л'],
    specs: [
      '100% синтетическое моторное масло 5W-40 (ACEA A3/B4, API SN), одобрено BMW LL-01, Porsche A40, VW 502 00 / 505 00',
      'высокая стойкость масляной плёнки при высоких температурах, оригинал Франция с проверочным QR-кодом',
    ],
    basePrice: 4690,
    tags: ['масло', 'моторное масло', '5w-40', '5w40', '5w-30', 'motul', 'автохимия'],
    icon: '🛢️',
  },
  {
    category: 'Автотовары и масла',
    prefix: 'Моторное масло',
    brand: 'Mobil',
    models: [
      'Super 3000 X1 5W-40 синтетическое',
      '1 FS X1 5W-40 синтетическое',
      '1 ESP 5W-30 малозольное',
      'Super 3000 XE 5W-30',
    ],
    variants: ['4 л', '1 л', '5 л'],
    specs: [
      'синтетическое автомасло 5W-40 для современных легковых автомобилей, кроссоверов и внедорожников с турбонаддувом',
      'эффективная очистка двигателя от шлама, стабильная вязкость в городских пробках и на трассе',
    ],
    basePrice: 4190,
    tags: ['масло', 'моторное масло', '5w-40', '5w40', 'mobil', 'автотовары'],
    icon: '🛢️',
  },
  {
    category: 'Автотовары и масла',
    prefix: 'Моторное масло',
    brand: 'Shell',
    models: [
      'Helix Ultra 5W-40 PurePlus',
      'Helix HX8 Synthetic 5W-40',
      'Helix HX7 5W-40',
      'Helix Ultra ECT C3 5W-30',
    ],
    variants: ['4 л', '1 л', '4+1 л акционный комплект'],
    specs: [
      'создано из природного газа по технологии Shell PurePlus, вязкость 5W-40, спецификации API SN+, ACEA A3/B4',
      'активные моющие присадки Active Cleansing удерживают чистоту поршневой группы близкой к заводской',
    ],
    basePrice: 3990,
    tags: ['масло', 'моторное масло', '5w-40', '5w40', 'shell', 'автохимия'],
    icon: '🛢️',
  },
  {
    category: 'Автотовары и масла',
    prefix: 'Масляный фильтр двигателя',
    brand: 'Mann-Filter',
    models: ['W 712/95 (VAG 1.4 TSI)', 'W 914/2 (Lada / ВАЗ)', 'W 811/80 (Hyundai / Kia)', 'W 610/3 (Honda / Mitsubishi)', 'HU 7020 z (TDI)'],
    variants: ['оригинал Германия', 'с обратным антидренажным клапаном', 'усиленный корпус'],
    specs: [
      'фильтрующий элемент тонкой очистки масла для планового ТО с заменой масла 5W-40 / 5W-30, перепускной клапан 2.5 бар',
    ],
    basePrice: 890,
    tags: ['фильтр', 'масляный фильтр', 'автозапчасти', 'то', 'mann'],
    icon: '⚙️',
  },

  // 5. Ноутбуки и компьютеры
  {
    category: 'Ноутбуки и компьютеры',
    prefix: 'Ноутбук',
    brand: 'ASUS',
    models: ['VivoBook 15 X1504ZA', 'VivoBook 16X K3605ZC', 'ZenBook 14 OLED UX3402', 'TUF Gaming F15 FX507ZC4', 'ExpertBook B1 B1502'],
    variants: [
      '15.6" IPS, Core i5-1235U, 16GB, 512GB SSD, Quiet Blue',
      '16" WUXGA, Core i5-12450H, RTX 3050, 16GB, 512GB SSD, Silver',
      '14" 2.8K OLED 90Hz, Core i7-1360P, 16GB, 1TB SSD, Ponder Blue',
      '15.6" FHD 144Hz, Core i5-12500H, RTX 4050, 16GB, 512GB SSD, Gray',
    ],
    specs: [
      'тонкий металлический корпус, раскрытие крышки на 180°, клавиатура с подсветкой ErgoSense, быстрая зарядка по USB-C',
      'эффективное охлаждение IceCool, Wi-Fi 6E, аппаратная шторка веб-камеры',
    ],
    basePrice: 54990,
    tags: ['ноутбук', 'ультрабук', 'компьютер', 'asus', 'работа', 'учеба'],
    icon: '💻',
  },
  {
    category: 'Ноутбуки и компьютеры',
    prefix: 'Ноутбук',
    brand: 'Lenovo',
    models: ['IdeaPad Slim 5 16IAH8', 'ThinkPad E16 Gen 1', 'Legion Slim 5 16APH8', 'Yoga Pro 7 14IRH8', 'V15 G4 AMN'],
    variants: [
      '16" IPS 300 нит, Core i5-12450H, 16GB LPDDR5, 512GB SSD, Cloud Grey',
      '16" WUXGA, Ryzen 7 7730U, 16GB, 512GB NVMe, Graphite Black',
      '16" WQXGA 165Hz, Ryzen 7 7840HS, RTX 4060 8GB, 16GB, 1TB SSD, Storm Grey',
      '15.6" FHD, Ryzen 5 7520U, 8GB, 256GB SSD, Business Black',
    ],
    specs: [
      'надёжный ноутбук для работы, программирования и аналитики, сканер отпечатка пальца, полноразмерный HDMI и Thunderbolt 4',
    ],
    basePrice: 58990,
    tags: ['ноутбук', 'lenovo', 'thinkpad', 'компьютер', 'офис', 'игровой'],
    icon: '💻',
  },
  {
    category: 'Ноутбуки и компьютеры',
    prefix: 'Механическая клавиатура',
    brand: 'Keychron',
    models: ['K2 Pro QMK/VIA Wireless', 'K8 Pro TKL Hot-Swap', 'V1 Max 75% Knob', 'K3 Ultra-Slim Optical', 'Q1 Pro Custom Aluminum'],
    variants: ['Red Switch, RU/EN, Carbon Black', 'Brown Tactile Switch, RU/EN, Grey', 'Banana Switch, White Backlit'],
    specs: [
      'беспроводная механическая клавиатура Bluetooth 5.1 / 2.4 ГГц / Type-C, PBT кейкапы двойного литья, совместимость с macOS и Windows',
    ],
    basePrice: 9490,
    tags: ['клавиатура', 'механическая клавиатура', 'keychron', 'периферия'],
    icon: '⌨️',
  },

  // 6. Бытовая техника
  {
    category: 'Бытовая техника',
    prefix: 'Автоматическая кофемашина',
    brand: 'DeLonghi',
    models: ['Magnifica Start ECAM220.22.GB', 'Magnifica Evo ECAM290.61.B', 'Dinamica ECAM350.55.B', 'Rivelia EXAM440.55.G', 'PrimaDonna Soul'],
    variants: ['чёрно-серебристая', 'графит металлик', 'титановый корпус', 'чёрный глянец'],
    specs: [
      'итальянская помпа 15 бар, встроенная жерновая кофемолка на 13 степеней помола, автоматический капучинатор LatteCrema',
      'приготовление эспрессо, американо, капучино и латте макиато одним нажатием, съёмный заварочный блок',
    ],
    basePrice: 39990,
    tags: ['кофемашина', 'бытовая техника', 'кофе', 'эспрессо', 'delonghi', 'кухня'],
    icon: '☕',
  },
  {
    category: 'Бытовая техника',
    prefix: 'Робот-пылесос с влажной уборкой',
    brand: 'Roborock',
    models: ['Q Revo Black', 'Q8 Max+ со станцией самоочистки', 'S8 Pro Ultra', 'Q7 Max White', 'S7 Max Ultra'],
    variants: ['White', 'Black', 'Russian Version (голосовой пакет RU)'],
    specs: [
      'лазерная навигация PreciSense LiDAR + обход препятствий Reactive Tech, мощность всасывания 5500–6000 Па',
      'построение 3D-карты квартиры в приложении, подъём салфеток при заезде на ковёр, аккумулятор 5200 мАч',
    ],
    basePrice: 32990,
    tags: ['робот-пылесос', 'пылесос', 'бытовая техника', 'умный дом', 'уборка', 'roborock'],
    icon: '🤖',
  },
  {
    category: 'Бытовая техника',
    prefix: 'Вертикальный беспроводной пылесос',
    brand: 'Dreame',
    models: ['T30 Neo', 'R20 Aqua', 'V11 SE', 'H12 Pro Wet & Dry', 'Z10 Station'],
    variants: ['Space Gray', 'Gold/Grey', 'с насадкой для мытья пола'],
    specs: [
      'бесщёточный двигатель 150 000 об/мин, OLED-дисплей, автоматическая регулировка мощности по степени загрязнения, до 90 мин работы',
    ],
    basePrice: 21990,
    tags: ['пылесос', 'беспроводной пылесос', 'бытовая техника', 'уборка', 'dreame'],
    icon: '🧹',
  },

  // 7. Детские товары
  {
    category: 'Детские товары',
    prefix: 'Детский развивающий конструктор',
    brand: 'LEGO',
    models: [
      'Classic 10698 Большой набор для творчества (790 деталей)',
      'Technic 42151 Гоночный болид Bugatti Bolide',
      'City 60374 Пожарная командная машина',
      'Creator 3-в-1 31136 Экзотический попугай',
      'Duplo 10914 Большая коробка с кубиками для малышей',
    ],
    variants: ['возраст 4+', 'возраст 6+', 'возраст 9+', 'подарочный пластиковый бокс'],
    specs: [
      'оригинальный сертифицированный конструктор из безопасного ABS-пластика, развивает мелкую моторику и пространственное мышление ребёнка',
    ],
    basePrice: 3490,
    tags: ['детские', 'конструктор', 'игрушки', 'lego', 'детские товары', 'подарок'],
    icon: '🧸',
  },
  {
    category: 'Детские товары',
    prefix: 'Детский трёхколёсный самокат',
    brand: 'Micro',
    models: ['Mini Deluxe LED', 'Maxi Deluxe Foldable LED', 'Mini2Grow Magic LED', 'Sprite Alu'],
    variants: ['Aqua (бирюзовый)', 'Red (красный)', 'Purple (фиолетовый)', 'Navy Blue (синий)', 'Pink (розовый)'],
    specs: [
      'швейцарский кикборд с управлением наклоном руля, светящиеся полиуретановые колёса на подшипниках ABEC 9, телескопическая стойка',
    ],
    basePrice: 6490,
    tags: ['детские', 'самокат', 'детские товары', 'спорт', 'прогулка'],
    icon: '🛴',
  },
  {
    category: 'Детские товары',
    prefix: 'Прогулочная детская коляска',
    brand: 'Cybex',
    models: ['Beezy 2024', 'Orfeo Cabin-Size', 'Balios S Lux', 'Coya Rosegold', 'Libelle Ultra-Compact'],
    variants: ['Moon Black', 'Lava Grey', 'Ocean Blue', 'Canvas White', 'Sepia Black'],
    specs: [
      'складывание одной рукой за 3 секунды, полностью горизонтальное спальное место, капюшон XXL с защитой от солнца UPF50+, амортизация всех колёс',
    ],
    basePrice: 26990,
    tags: ['детские', 'коляска', 'детские товары', 'малыши'],
    icon: '👶',
  },

  // 8. Телевизоры и медиа
  {
    category: 'Телевизоры и медиа',
    prefix: 'Телевизор',
    brand: 'LG',
    models: ['OLED55C3RLA 55"', 'OLED65C3RLA 65"', '50UR81006LJ 50"', '55QNED816RA 55"', '43UR78001LJ 43"'],
    variants: ['4K Ultra HD, Smart TV webOS, пульт Magic Remote', '4K OLED evo 120 Гц, Dolby Vision, HDMI 2.1'],
    specs: [
      'интеллектуальный процессор α9 Gen6 4K, глубокий чёрный цвет, поддержка VRR / G-Sync / FreeSync для игровых консолей PS5 и Xbox',
    ],
    basePrice: 44990,
    tags: ['телевизор', '4k', 'smart tv', 'oled', 'lg', 'медиа'],
    icon: '📺',
  },
  {
    category: 'Телевизоры и медиа',
    prefix: 'Телевизор QLED',
    brand: 'TCL',
    models: ['55C647 55"', '65C745 65" 144Hz', '50C645 50"', '43P637 43"', '75C845 Mini-LED 75"'],
    variants: ['4K UHD, Google TV, голосовое управление без пульта', 'QLED Pro, звук Onkyo 2.1 Dolby Atmos'],
    specs: [
      'технология квантовых точек Quantum Dot (1 млрд оттенков), безрамочный металлический корпус, игровой ускоритель DLG 120/144 Гц',
    ],
    basePrice: 34990,
    tags: ['телевизор', 'qled', '4k', 'tcl', 'google tv', 'медиа'],
    icon: '📺',
  },

  // 9. Одежда и спорттовары (содержит "для бега" — ловушка для Category Gate)
  {
    category: 'Одежда и спорттовары',
    prefix: 'Ветрозащитная куртка для бега',
    brand: 'Craft',
    models: ['Adv Essence Wind Jacket', 'Pro Hypervent Split', 'Core Endur Hydro', 'SubZ Lumen Wind'],
    variants: ['мужская, р. M, Black', 'мужская, р. L, Neon Yellow', 'мужская, р. XL, Navy', 'женская, р. S, Coral'],
    specs: [
      'ультралёгкая беговая ветровка из дышащего рипстоп-полиэстера с водоотталкивающей пропиткой DWR, светоотражающие элементы 360°',
    ],
    basePrice: 6490,
    tags: ['одежда', 'бег', 'куртка', 'ветровка', 'спорт', 'craft'],
    icon: '🧥',
  },
  {
    category: 'Одежда и спорттовары',
    prefix: 'Спортивные часы для бега и триатлона',
    brand: 'Garmin',
    models: ['Forerunner 265 AMOLED', 'Forerunner 165 Music', 'Forerunner 965 Titanium', 'Instinct 2X Solar', 'Venu 3'],
    variants: ['Black/Powder Grey', 'Aqua/Black', 'Whitestone/Tidal Blue', 'Amp Yellow'],
    specs: [
      'многополосный двухчастотный GPS для точного трека пробежки, оценка готовности к тренировке, пульсоксиметр и мониторинг ВСР',
    ],
    basePrice: 28990,
    tags: ['часы', 'смарт-часы', 'бег', 'спорт', 'garmin', 'пульсометр'],
    icon: '⌚',
  },
  {
    category: 'Одежда и спорттовары',
    prefix: 'Нагрудный датчик пульса для бега',
    brand: 'Polar',
    models: ['H10 ANT+ / Bluetooth', 'H9 Heart Rate Sensor', 'Verity Sense Optical'],
    variants: ['размер M-XXL, Black', 'размер XS-S, Black', 'Red Crush Edition'],
    specs: [
      'эталонная ЭКГ-точность измерения ЧСС при интервальном беге, плавании и велоспорте, встроенная память на 1 тренировку, ремень Pro Strap',
    ],
    basePrice: 7490,
    tags: ['пульсометр', 'бег', 'спорт', 'тренировки', 'polar'],
    icon: '❤️',
  },

  // 10. Инструменты и ремонт
  {
    category: 'Инструменты и ремонт',
    prefix: 'Аккумуляторная дрель-шуруповёрт',
    brand: 'Makita',
    models: ['DDF484RFE 18В LXT', 'DF333DWYE 12В CXT', 'DHP485RFJ ударная 18В', 'DDF482Z бесщёточная'],
    variants: ['2 аккумулятора 3.0 А·ч + ЗУ + кейс', '2 аккумулятора 1.5 А·ч в чемодане', 'комплектация Makpac'],
    specs: [
      'бесщёточный двигатель BL Motor, крутящий момент 54 Н·м, быстрозажимной патрон 13 мм, 2 скорости + светодиодная подсветка рабочей зоны',
    ],
    basePrice: 9990,
    tags: ['инструменты', 'шуруповерт', 'дрель', 'makita', 'ремонт'],
    icon: '🪛',
  },
  {
    category: 'Инструменты и ремонт',
    prefix: 'Лазерный уровень (нивелир) 360°',
    brand: 'Bosch',
    models: ['GLL 3-80 CG Professional', 'UniversalLevel 360 Set', 'GLL 2-15 G Green', 'Quigo Green III'],
    variants: ['зелёный луч, со штативом 1.5 м', 'в ударопрочном кейсе L-BOXX', 'с настенным магнитным креплением BM 1'],
    specs: [
      'построение 3 замкнутых плоскостей 360° ярким зелёным лучом, автоматическое самовыравнивание за 4 с, точность ±0.2 мм/м',
    ],
    basePrice: 11490,
    tags: ['инструменты', 'лазерный уровень', 'нивелир', 'bosch', 'строительство'],
    icon: '📏',
  },

  // 11. Книги (включая технические и детские книги)
  {
    category: 'Книги',
    prefix: 'Книга',
    brand: 'Питер / O’Reilly',
    models: [
      '«Высоконагруженные приложения. Программирование, масштабирование, поддержка», М. Клеппман',
      '«Грокаем алгоритмы. Иллюстрированное пособие для программистов», А. Бхаргава',
      '«Чистая архитектура. Искусство разработки ПО», Роберт Мартин',
      '«Внутреннее устройство Linux», Брайан Уорд',
      '«Паттерны проектирования на TypeScript и Python», Э. Фримен',
    ],
    variants: ['твёрдый переплёт, 2025 г.', 'мягкая обложка, исправленное издание', 'подарочное издание на офсетной бумаге'],
    specs: [
      'профессиональная литература для разработчиков, архитекторов и SRE-инженеров, разбор распределённых БД, индексов и очередей',
    ],
    basePrice: 1490,
    tags: ['книги', 'программирование', 'архитектура', 'алгоритмы', 'it'],
    icon: '📚',
  },
  {
    category: 'Книги',
    prefix: 'Детская иллюстрированная книга',
    brand: 'МИФ Детство',
    models: [
      '«Как устроен космос и солнечная система. Энциклопедия с окошками»',
      '«Приключения Незнайки и его друзей», Николай Носов',
      '«Денискины рассказы для младших школьников», Виктор Драгунский',
      '«Логические задачки и головоломки для детей 7–10 лет»',
    ],
    variants: ['твёрдый переплёт, мелованная бумага', 'крупный шрифт для самостоятельного чтения', 'большой подарочный формат'],
    specs: [
      'красочные авторские иллюстрации на каждом развороте, развивающая книга для детей дошкольного и младшего школьного возраста',
    ],
    basePrice: 790,
    tags: ['книги', 'детские', 'детская книга', 'чтение', 'школа'],
    icon: '📖',
  },
];

/**
 * Generates deterministic 1048 SKU realistic store catalog.
 * - First 18 items are the clean RU items from DEMO_CATALOG (IDs '1'..'18') so existing recommend/search tests have ID '1', '2', etc., WITHOUT any JP/ZH/ES/DE review buckets.
 * - Remaining 1,030 items are generated from realistic product series with 100% unique titles, real brand/model names, and realistic specs.
 */
export function buildDemoCatalog1000(targetTotal: number = 1048): CatalogItem[] {
  const baseRuItems = DEMO_CATALOG.slice(0, 18);
  const items: CatalogItem[] = [...baseRuItems];
  const seenTitles = new Set<string>(baseRuItems.map((it) => it.title));
  const prng = mulberry32(2026);

  let seq = 101;

  // Pass 1: deterministically iterate through all series -> models -> variants -> batches
  let batchRound = 0;
  while (items.length < targetTotal) {
    batchRound++;
    for (let sIdx = 0; sIdx < PRODUCT_CATALOG_SERIES.length && items.length < targetTotal; sIdx++) {
      const series = PRODUCT_CATALOG_SERIES[sIdx];
      const model = series.models[(seq + batchRound) % series.models.length];
      const variant = series.variants[(seq + sIdx + batchRound * 2) % series.variants.length];
      const spec = series.specs[(seq + batchRound) % series.specs.length];

      // Build a natural Russian product title without duplicate words
      const articleCode = `Арт. E-${20000 + seq * 2}`;
      let title = `${series.prefix} ${series.brand} ${model} (${variant})`;
      if (seenTitles.has(title)) {
        title = `${series.prefix} ${series.brand} ${model} — ${variant} (${articleCode})`;
      }
      seenTitles.add(title);

      const id = `sku-ecom-${String(seq * 2).padStart(5, '0')}`;

      // Realistic price with slight variation
      const factor = 0.85 + prng() * 0.35;
      let price = Math.round((series.basePrice * factor) / 100) * 100 + 50;
      if (series.tags.includes('до 15000') && price > 14900) {
        price = 12850;
      }

      const rating = Math.round((4.3 + prng() * 0.65) * 10) / 10;
      const reviews = Math.floor(prng() * 850) + 14;
      const badges = ['Хит продаж', 'Выбор покупателей', 'Скидка -15%', 'Новинка', undefined, undefined];
      const badge = badges[Math.floor(prng() * badges.length)];

      const description = `${series.brand} ${model} (${variant}): ${spec}. Официальная гарантия 1 год, в наличии на складе (${articleCode}).`;

      items.push({
        id,
        title,
        description,
        category: series.category,
        price,
        inStock: prng() > 0.04,
        tags: [...series.tags],
        rating,
        reviews,
        badge,
        icon: series.icon,
      });

      seq++;
    }
  }

  return items;
}

export const DEMO_CATALOG_1000 = buildDemoCatalog1000(1048);
