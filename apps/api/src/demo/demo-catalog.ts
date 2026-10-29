export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  inStock: boolean;
  tags: string[];
  rating?: number;
  reviews?: number;
  badge?: string;
  icon?: string;
}

export const DEMO_CATALOG: CatalogItem[] = [
  // 1. Маркетплейс & E-Commerce (18 SKU)
  {
    id: '1',
    title: 'Cyberpunk 2077',
    description:
      'Открытый мир Найт-Сити, киберпанк, RPG, симуляция будущего, импланты и искусственный интеллект',
    category: 'Игры',
    price: 2999,
    inStock: true,
    rating: 4.8,
    reviews: 14820,
    badge: 'Хит продаж',
    icon: '🌆',
    tags: ['киберпанк', 'симуляция', 'rpg', 'будущее'],
  },
  {
    id: '2',
    title: 'Матрица',
    description:
      'Культовый фильм, симуляция реальности, sci-fi, восстание машин, киберпанк и поиск истины',
    category: 'Фильмы',
    price: 499,
    inStock: true,
    rating: 4.9,
    reviews: 32900,
    badge: 'Классика',
    icon: '🕶️',
    tags: ['симуляция', 'киберпанк', 'ии', 'фильм'],
  },
  {
    id: '3',
    title: 'Дюна',
    description:
      'Научная фантастика Фрэнка Герберта, песчаная планета Арракис, космическая политика, пророчество и спайс',
    category: 'Книги',
    price: 890,
    inStock: true,
    rating: 4.9,
    reviews: 8430,
    badge: 'Бестселлер',
    icon: '🏜️',
    tags: ['космос', 'фантастика', 'дюна', 'политика'],
  },
  {
    id: '4',
    title: 'Книга Python: Полное руководство',
    description:
      'Программирование с нуля, обучение, код, алгоритмы, backend-разработка и нейросети',
    category: 'Книги',
    price: 1450,
    inStock: true,
    rating: 4.7,
    reviews: 4120,
    badge: 'Выбор экспертов',
    icon: '🐍',
    tags: ['программирование', 'обучение', 'код', 'python'],
  },
  {
    id: '5',
    title: 'Кофемашина Barista Pro',
    description:
      'Премиальная бытовая техника, 15 бар, эспрессо, капучино, встроенная кофемолка, зерновой кофе',
    category: 'Техника',
    price: 42990,
    inStock: true,
    rating: 4.9,
    reviews: 2150,
    badge: 'Топ комфорт',
    icon: '☕',
    tags: ['кофе', 'бытовая техника', 'эспрессо', 'капучино'],
  },
  {
    id: '6',
    title: 'The Witcher 3: Дикая Охота',
    description:
      'Фэнтези RPG, открытый мир, магия, чудовища, ведьмак Геральт, моральный выбор и эпос',
    category: 'Игры',
    price: 1999,
    inStock: true,
    rating: 4.95,
    reviews: 54100,
    badge: 'Шедевр',
    icon: '⚔️',
    tags: ['фэнтези', 'магия', 'rpg', 'ведьмак'],
  },
  {
    id: '7',
    title: 'Фильм "Интерстеллар"',
    description:
      'Научно-фантастический шедевр Кристофера Нолана о релятивистском времени, черных дырах и любви сквозь космос',
    category: 'Фильмы',
    price: 599,
    inStock: true,
    rating: 4.9,
    reviews: 48900,
    badge: 'Культ',
    icon: '🌌',
    tags: ['космос', 'фантастика', 'нолан', 'время'],
  },
  {
    id: '8',
    title: 'Ноутбук ProBook X1 Metal',
    description:
      'Флагманский ультрабук для программирования и работы, Intel Core i7, 32GB RAM, 1TB SSD, 16" 120Hz',
    category: 'Техника',
    price: 119900,
    inStock: true,
    rating: 4.8,
    reviews: 980,
    badge: 'Для профи',
    icon: '💻',
    tags: ['компьютер', 'работа', 'код', 'ноутбук'],
  },
  {
    id: '9',
    title: 'Беспроводные наушники SoundMax ANC',
    description:
      'Премиальный Hi-Res звук, адаптивное активное шумоподавление, Bluetooth 5.3, 45 часов автономности',
    category: 'Техника',
    price: 14990,
    inStock: true,
    rating: 4.8,
    reviews: 6200,
    badge: 'Чистый звук',
    icon: '🎧',
    tags: ['звук', 'музыка', 'bluetooth', 'наушники'],
  },
  {
    id: '10',
    title: 'Книга "1984" Джорджа Оруэлла',
    description:
      'Роман-антиутопия о тоталитарном надзоре, Большом Брате, новоязе и борьбе за свободу мысли',
    category: 'Книги',
    price: 650,
    inStock: true,
    rating: 4.85,
    reviews: 19400,
    badge: 'Вечная классика',
    icon: '👁️',
    tags: ['антиутопия', 'оруэлл', 'контроль', 'политика'],
  },
  {
    id: '11',
    title: 'Книга "Гарри Поттер и философский камень"',
    description:
      'Магический мир Хогвартса, уроки зельеварения, дружба, тайны замка и великие заклинания',
    category: 'Книги',
    price: 920,
    inStock: true,
    rating: 4.9,
    reviews: 31000,
    badge: 'Любимое с детства',
    icon: '⚡',
    tags: ['фэнтези', 'магия', 'обучение', 'хогвартс'],
  },
  {
    id: '12',
    title: 'Фильм "Начало"',
    description:
      'Интеллектуальный триллер Кристофера Нолана о многоуровневых снах, архитектуре подсознания и иллюзиях',
    category: 'Фильмы',
    price: 499,
    inStock: true,
    rating: 4.85,
    reviews: 29800,
    badge: 'Выбор критиков',
    icon: '🌀',
    tags: ['сны', 'нолан', 'триллер', 'разум'],
  },
  {
    id: '13',
    title: 'Игра "Stray"',
    description:
      'Уютное и трогательное приключение рыжего кота в неоновом кибергороде забытых роботов',
    category: 'Игры',
    price: 1299,
    inStock: true,
    rating: 4.8,
    reviews: 17200,
    badge: 'Инди-триумф',
    icon: '🐱',
    tags: ['кот', 'киберпанк', 'роботы', 'приключения'],
  },
  {
    id: '14',
    title: 'Смартфон Galaxy Ultra Pro',
    description:
      'Флагманский камерофон 200 Мп с AI-обработкой кадров, стилусом S-Pen и Dynamic AMOLED 2X 120Hz',
    category: 'Техника',
    price: 89990,
    inStock: true,
    rating: 4.75,
    reviews: 4890,
    badge: 'Флагман года',
    icon: '📱',
    tags: ['телефон', 'гаджет', 'камера', 'флагман'],
  },
  {
    id: '15',
    title: 'Кроссовки RunMax Aero Carbon',
    description:
      'Профессиональная беговая обувь с карбоновой пластиной, упругой пеной и дышащей мембраной',
    category: 'Спорт',
    price: 12490,
    inStock: true,
    rating: 4.85,
    reviews: 3100,
    badge: 'Выбор марафонцев',
    icon: '👟',
    tags: ['бег', 'спорт', 'обувь', 'тренировки'],
  },
  {
    id: '16',
    title: 'Умный фитнес-браслет BandPro 8',
    description:
      'Круглосуточный мониторинг SpO2, вариабельности пульса, фаз сна и 120 спортивных режимов',
    category: 'Спорт',
    price: 3990,
    inStock: true,
    rating: 4.7,
    reviews: 8400,
    badge: 'Бестселлер',
    icon: '⌚',
    tags: ['спорт', 'фитнес', 'пульс', 'трекер'],
  },
  {
    id: '17',
    title: 'Фильм "Властелин колец: Братство кольца"',
    description:
      'Величайшая экранизация эпоса Дж. Р. Р. Толкина о спасении Средиземья, братстве и магии',
    category: 'Фильмы',
    price: 599,
    inStock: true,
    rating: 4.95,
    reviews: 62000,
    badge: 'Шедевр кинематографа',
    icon: '💍',
    tags: ['фэнтези', 'эпос', 'толкин', 'магия'],
  },
  {
    id: '18',
    title: 'Настольная игра "Монополия Deluxe"',
    description:
      'Классическая экономическая стратегия с металлическими фишками, аукционами и покупкой недвижимости',
    category: 'Игры',
    price: 3490,
    inStock: true,
    rating: 4.65,
    reviews: 5800,
    badge: 'Для всей семьи',
    icon: '🎲',
    tags: ['настолка', 'экономика', 'стратегия', 'семья'],
  },
  // 2. Streaming Platform (12 SKU)
  {
    id: 'str_1',
    title: 'Interstellar (4K IMAX Remaster)',
    description:
      'Christopher Nolan sci-fi epic exploring relativistic time dilation, black holes, wormholes, and humanity survival across cosmos',
    category: 'Sci-Fi Cinema',
    price: 599,
    inStock: true,
    tags: ['space', 'interstellar', 'nolan', 'blackhole', 'time', 'sci-fi'],
  },
  {
    id: 'str_2',
    title: 'Dune: Part Two (Dolby Vision)',
    description:
      'Epic desert planet Arrakis saga of galactic politics, prophecy, spice control, and cosmic destiny',
    category: 'Sci-Fi Cinema',
    price: 699,
    inStock: true,
    tags: ['dune', 'space', 'sci-fi', 'cosmos', 'cinema'],
  },
  {
    id: 'str_3',
    title: 'Cyberpunk: Edgerunners — Complete Series',
    description:
      'High-octane neon night city anime series about cybernetic implants, artificial intelligence, hackers, and corporate dystopia',
    category: 'Anime & Series',
    price: 799,
    inStock: true,
    tags: ['cyberpunk', 'anime', 'ai', 'neon', 'simulation', 'future'],
  },
  {
    id: 'str_4',
    title: 'The Matrix (35mm Director Restoration)',
    description:
      'Iconic cyberpunk thriller questioning simulated reality, neural networks, machine uprising, and digital awakening',
    category: 'Sci-Fi Cinema',
    price: 499,
    inStock: true,
    tags: ['matrix', 'cyberpunk', 'simulation', 'ai', 'hacker'],
  },
  {
    id: 'str_5',
    title: 'Inception: Architecture of Dreams',
    description:
      'Psychological heist thriller inside multi-layered subconscious dreams, memory manipulation, and time distortion',
    category: 'Psychological Thriller',
    price: 499,
    inStock: true,
    tags: ['inception', 'dreams', 'nolan', 'thriller', 'cinema'],
  },
  {
    id: 'str_6',
    title: 'Cosmos & Event Horizon: Black Hole Documentary',
    description:
      'Deep astrophysics documentary series visualizing gravitational waves, event horizons, and quantum cosmology',
    category: 'Documentary',
    price: 399,
    inStock: true,
    tags: ['space', 'cosmos', 'blackhole', 'astrophysics', 'documentary'],
  },
  {
    id: 'str_7',
    title: 'Silicon & Rust: Inside Modern AI Supercomputers',
    description:
      'Feature engineering documentary on distributed vector databases, GPU clusters, Rust systems, and neural architectures',
    category: 'Documentary',
    price: 399,
    inStock: true,
    tags: ['ai', 'rust', 'database', 'programming', 'documentary'],
  },
  {
    id: 'str_8',
    title: 'The Witcher: Nightmare of the Wolf',
    description:
      'Dark fantasy animated film of monster hunters, ancient magic, alchemy, and mythic creatures across the Continent',
    category: 'Anime & Series',
    price: 499,
    inStock: true,
    tags: ['witcher', 'fantasy', 'magic', 'anime', 'rpg'],
  },
  {
    id: 'str_9',
    title: 'Night City Synthwave & Lo-Fi Coding Sessions (Dolby Atmos)',
    description:
      'Spatial audio soundtrack stream designed for deep programming focus, late-night coding, and cyberpunk ambiance',
    category: 'Audio Stream',
    price: 299,
    inStock: true,
    tags: ['music', 'synthwave', 'lofi', 'cyberpunk', 'coding', 'sound'],
  },
  {
    id: 'str_10',
    title: '1984: Totalitarian Surveillance State',
    description:
      'Chilling political drama based on George Orwell dystopian masterpiece about thought control and freedom',
    category: 'Psychological Thriller',
    price: 450,
    inStock: true,
    tags: ['1984', 'orwell', 'dystopia', 'surveillance', 'history'],
  },
  {
    id: 'str_11',
    title: 'Artisan Espresso: From Tokyo Roasteries to Milan',
    description:
      'Cinematic culinary series exploring specialty coffee roasting, espresso extraction physics, and third-wave cafe culture',
    category: 'Lifestyle & Culinary',
    price: 399,
    inStock: true,
    tags: ['coffee', 'espresso', 'barista', 'cafe', 'documentary'],
  },
  {
    id: 'str_12',
    title: 'Breaking the 2-Hour Marathon Barrier',
    description:
      'Sports science documentary following elite marathon runners, carbon-plate biomechanics, and biometric endurance training',
    category: 'Sports & Documentary',
    price: 499,
    inStock: true,
    tags: ['running', 'marathon', 'sport', 'fitness', 'documentary'],
  },
  // 3. Japanese Video Hosting (14 SKU)
  {
    id: 'jp_1',
    title: '【4K科学ドキュメンタリー】宇宙の果てとブラックホールの事象の地平線・相対性理論を完全解説',
    description:
      'アインシュタインの一般相対性理論、ブラックホール周囲の重力レンズ効果、時間の遅れと多元宇宙の最新天文学をCGで徹底解説する科学動画。',
    category: '科学・宇宙',
    price: 500,
    inStock: true,
    tags: ['宇宙', 'ブラックホール', '科学', 'ドキュメンタリー', '相対性理論', '時間'],
  },
  {
    id: 'jp_2',
    title: 'クリストファー・ノーラン監督『インターステラー』と『デューン』の宇宙物理学・時間軸を徹底考察',
    description:
      'SF映画の金字塔インターステラーとデューン砂の惑星に隠されたブラックホール科学、重力波、五次元空間の演出を深掘り解説する映画考察動画。',
    category: '映画・考察',
    price: 450,
    inStock: true,
    tags: ['宇宙', 'インターステラー', 'デューン', '映画', 'ノーラン', '科学', '考察動画'],
  },
  {
    id: 'jp_3',
    title: '【サイバーパンク2077】ナイトシティ最高難易度・電脳ハッカービルド完全攻略＆ゲーム実況 #01',
    description:
      'ネオン輝く近未来都市ナイトシティを舞台に、人工知能AIとサイバーウェア改造を駆使して挑むオープンワールドRPGゲーム実況プレイ配信。',
    category: 'ゲーム実況',
    price: 600,
    inStock: true,
    tags: ['サイバーパンク', 'ゲーム実況', '人工知能', 'ナイトシティ', '未来', 'ハッカー', 'rpg'],
  },
  {
    id: 'jp_4',
    title: '野良猫がサイバー都市を旅する感動作『Stray（ストレイ）』全チャプター完全クリア実況配信',
    description:
      '忘れ去られたロボットたちが暮らすネオン街に迷い込んだ一匹の猫の冒険。サイバーパンクの世界観と心温まるストーリーを楽しむインディーゲーム実況。',
    category: 'ゲーム実況',
    price: 550,
    inStock: true,
    tags: ['ストレイ', '猫', 'サイバーパンク', 'ロボット', 'ゲーム実況', 'インディーゲーム'],
  },
  {
    id: 'jp_5',
    title: '【Rust × WebAssembly】ゼロから作る超高速ベクトルデータベースとHNSW検索アルゴリズム実装講座',
    description:
      'システムプログラミング言語RustとWebAssemblyを用いて、384次元ベクトル検索とHNSWインデックスをブラウザとサーバーで高速動作させるエンジニア向け開発講座。',
    category: 'プログラミング・IT',
    price: 1200,
    inStock: true,
    tags: ['プログラミング', 'rust', 'データベース', '開発', 'アルゴリズム', 'ベクトル', '講座'],
  },
  {
    id: 'jp_6',
    title: '【Python深層学習】TransformerとE5マルチリンガルモデルで作る次世代AIレコメンドシステム入門',
    description:
      'Pythonとニューラルネットワークを使って、ECサイトや動画配信プラットフォーム向けのセマンティック検索・推薦エンジンを構築する実践コード解説。',
    category: 'プログラミング・IT',
    price: 1100,
    inStock: true,
    tags: ['python', 'プログラミング', '人工知能', '開発', 'コード', 'アルゴリズム', '解説'],
  },
  {
    id: 'jp_7',
    title: '【エンジニアのデスクツアー】最新ハイエンドノートPC＆カスタムメカニカルキーボード作業環境紹介',
    description:
      'ソフトウェア開発と動画編集を快適にする究極のデスクツアー。自作メカニカルキーボード、4Kモニター、エルゴノミクスチェアを徹底レビュー。',
    category: 'ガジェット・レビュー',
    price: 800,
    inStock: true,
    tags: ['ノートpc', 'パソコン', 'キーボード', 'ガジェット', 'レビュー', 'デスクツアー', '開発'],
  },
  {
    id: 'jp_8',
    title: '【京都カフェVLOG】朝のルーティンと自宅エスプレッソマシンで淹れる極上ラテアートの作り方',
    description:
      '京都の路地裏にある隠れ家ロースタリー巡りと、本格エスプレッソマシンを使った深煎り珈琲豆の抽出レシピを紹介する朝活ライフスタイルVLOG。',
    category: 'Vlog・ライフスタイル',
    price: 400,
    inStock: true,
    tags: ['コーヒー', 'エスプレッソ', 'カフェ', 'バリスタ', '朝活', 'ルーティン', 'ラテ'],
  },
  {
    id: 'jp_9',
    title: '【作業用BGM】深夜の東京ネオン街と雨音・集中力を極限まで高めるLo-Fi HipHop & Synthwave配信',
    description:
      'プログラミングや読書、勉強、朝のコーヒータイムに最適な高音質チルアウト音楽ストリーム。心地よいビートと環境音で深い集中へ。',
    category: '音楽・作業用BGM',
    price: 300,
    inStock: true,
    tags: ['音楽', '作業用bgm', 'lofi', '深夜', '高音質', 'サイバーパンク', 'コーヒー'],
  },
  {
    id: 'jp_10',
    title: 'フラッグシップ無線ノイズキャンセリングヘッドホン5機種を音響エンジニアが徹底比較レビュー',
    description:
      'ハイレゾ音源再生とアクティブノイズキャンセリング性能、空間オーディオの臨場感をプロの音響視点で検証するガジェット＆オーディオ解説。',
    category: 'ガジェット・レビュー',
    price: 750,
    inStock: true,
    tags: ['ヘッドホン', 'イヤホン', 'ノイズキャンセリング', '高音質', '音楽', 'ガジェット', 'レビュー'],
  },
  {
    id: 'jp_11',
    title: '【アニメ背景美術メイキング】ファンタジー魔法世界と古代遺跡を描くデジタルイラスト講座',
    description:
      '劇場版アニメの美術監督が教える、重厚なファンタジーRPGの世界観・魔法陣のエフェクト・光と影の色彩設計メイキング動画。',
    category: 'アニメ・イラスト',
    price: 900,
    inStock: true,
    tags: ['ファンタジー', '魔法', 'アニメ', 'メイキング', 'イラスト', '背景美術', '異世界'],
  },
  {
    id: 'jp_12',
    title: 'ダークファンタジーの最高峰『ウィッチャー3』神話と魔法の物語を100倍楽しむ世界観解説',
    description:
      '怪物狩りのウィッチャー・ゲラルトの壮大な冒険と北欧・スラブ神話のルーツ、魔法と選択の重みを徹底解説するファンタジー考察動画。',
    category: 'ゲーム実況',
    price: 500,
    inStock: true,
    tags: ['ファンタジー', 'ウィッチャー', '魔法', 'rpg', 'ゲーム実況', '神話'],
  },
  {
    id: 'jp_13',
    title: '【サブ3達成】カーボンプレート搭載ランニングシューズ徹底比較＆スマートウォッチ心拍トレーニング',
    description:
      'フルマラソン完走から自己ベスト更新まで、最新ランニングシューズの反発力検証と心拍数ゾーン管理による効率的な持久力トレーニング講座。',
    category: 'スポーツ・フィットネス',
    price: 650,
    inStock: true,
    tags: ['ランニング', 'マラソン', 'シューズ', 'スマートウォッチ', 'トレーニング', 'フィットネス'],
  },
  {
    id: 'jp_14',
    title: 'ジョージ・オーウェル『1984年』と現代のAI監視社会・潜在意識を巡る哲学ドキュメンタリー',
    description:
      'ディストピア文学の名作1984年と映画インセプションを題材に、情報統制、アルゴリズムによる思考誘導、人間の自由意志を考察する教養番組。',
    category: '映画・考察',
    price: 500,
    inStock: true,
    tags: ['ディストピア', '監視社会', '哲学', '映画', 'インセプション', '人工知能', '考察'],
  },
  // 4. Multilingual ZH / ES / DE (4 SKU)
  {
    id: 'zh_1',
    title: '【4K科学纪录片】星际穿越与黑洞视界：探索宇宙深处的相对论奥秘',
    description:
      '深入解析爱因斯坦广义相对论、黑洞引力波与星际航行科学，带你领略壮丽的宇宙时空。',
    category: '科学纪录片 (ZH)',
    price: 480,
    inStock: true,
    tags: ['宇宙', '黑洞', '星际穿越', '科学', '纪录片', 'space'],
  },
  {
    id: 'zh_2',
    title: '【硬核编程】使用 Rust 与高性能向量数据库构建毫秒级 AI 语义搜索引擎',
    description:
      '从零实现 384 维稠密向量索引、HNSW 图检索算法与混合重排序架构，面向生产环境的系统开发教程。',
    category: '技术开发 (ZH)',
    price: 980,
    inStock: true,
    tags: ['编程', '数据库', '算法', '开发', 'rust', '人工智能'],
  },
  {
    id: 'es_1',
    title: 'Documental 4K: El Cosmos, Agujeros Negros y el Tiempo Relativista',
    description:
      'Un viaje cinematográfico por el universo, la física de los agujeros negros y la exploración espacial inspirada en Interstellar.',
    category: 'Ciencia y Cine (ES)',
    price: 450,
    inStock: true,
    tags: ['espacio', 'cosmos', 'película', 'space', 'interstellar'],
  },
  {
    id: 'de_1',
    title: 'Moderne KI & Rust Datenbanken: Hochgeschwindigkeits-Vektorsuche in der Praxis',
    description:
      'Architektur-Deep-Dive über 384-dimensionale Embeddings, HNSW-Graphen und Echtzeit-Empfehlungssysteme für Streaming und E-Commerce.',
    category: 'Engineering (DE)',
    price: 890,
    inStock: true,
    tags: ['programmierung', 'rust', 'database', 'ai', 'wissenschaft'],
  },
];

export const DEMO_ITEMS_COUNT = DEMO_CATALOG.length;
