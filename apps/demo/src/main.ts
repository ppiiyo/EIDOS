import { Recommender, DemoItem } from './semantic/recommender';
import { renderCatalog } from './ui/catalog';
import { renderRecommendations } from './ui/recommendations';
import { renderSearchResults } from './ui/search';
import { GraphCanvasRenderer } from './ui/graph-view';
import { generateGraphStructure } from './semantic/graph';

let recommender: Recommender;
let graphRenderer: GraphCanvasRenderer | null = null;
let allItems: DemoItem[] = [];
let selectedItemId: string | null = null;

async function bootstrap() {
  const catalogCount = document.getElementById('catalog-count');
  const catalogContainer = document.getElementById('catalog-container') as HTMLElement;
  const recsContainer = document.getElementById('recommendations-section') as HTMLElement;
  const statusTag = document.getElementById('status-tag') as HTMLElement;
  const filterInput = document.getElementById('catalog-filter-input') as HTMLInputElement;
  const searchInput = document.getElementById('semantic-search-input') as HTMLInputElement;
  const btnSearch = document.getElementById('btn-search') as HTMLButtonElement;

  const tabRecs = document.getElementById('tab-recs') as HTMLButtonElement;
  const tabGraph = document.getElementById('tab-graph') as HTMLButtonElement;
  const viewRecs = document.getElementById('view-recs') as HTMLElement;
  const viewGraph = document.getElementById('view-graph') as HTMLElement;
  const canvas = document.getElementById('graph-canvas') as HTMLCanvasElement;

  // Initialize Recommender
  recommender = new Recommender();

  const switchToRecs = () => {
    tabRecs.classList.add('active');
    tabGraph.classList.remove('active');
    viewRecs.style.display = 'flex';
    viewGraph.style.display = 'none';
  };

  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const catalogUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}data/catalog.json`;
    const response = await fetch(catalogUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = (await response.json()) as any[];
    allItems = raw.map((it) => ({
      ...it,
      id: String(it.id),
      price: typeof it.price === 'number' ? it.price : (parseFloat(String(it.price).replace(/[^0-9.]/g, '')) || 99),
    }));
  } catch {
    // Fallback seed items
    allItems = [
      {
        id: 'prod-001',
        title: 'Ergonomic Split Mechanical Keyboard',
        description: 'Ortholinear mechanical split keyboard with hot-swappable switches and wrist pads.',
        category: 'Electronics',
        tags: ['hardware', 'ergonomics', 'typing'],
        price: 189.0,
      },
      {
        id: 'prod-002',
        title: 'Walnut Wood Wrist Rest for Mechanical Keyboards',
        description: 'Smooth American walnut wrist cushion with non-slip rubber feet for typing posture.',
        category: 'Accessories',
        tags: ['ergonomics', 'desk-setup', 'woodwork'],
        price: 34.0,
      },
      {
        id: 'prod-003',
        title: 'Ultra-Wide Asymmetric Desk Monitor Light Bar',
        description: 'Auto-dimming anti-glare screen light reducing ocular fatigue during night work.',
        category: 'Office',
        tags: ['lighting', 'workspace', 'productivity'],
        price: 79.5,
      },
      {
        id: 'prod-004',
        title: 'Active Noise Cancelling Wireless Headphones',
        description: 'Over-ear headphones with hybrid 4-mic ANC, memory foam ear cups, and 35h battery.',
        category: 'Audio',
        tags: ['audio', 'focus', 'wireless'],
        price: 229.0,
      },
      {
        id: 'prod-005',
        title: 'Precision Programmable Ergonomic Trackball Mouse',
        description: 'Sculpted wireless trackball with adjustable 20-degree tilt hinge and thumb control.',
        category: 'Electronics',
        tags: ['mouse', 'ergonomics', 'hardware'],
        price: 99.0,
      },
    ];
  }

  // Ensure items have vectors
  recommender.loadCatalog(allItems);
  recommender.indexAll().catch(console.warn);

  if (catalogCount) catalogCount.textContent = `${allItems.length} items loaded`;

  const handleSelect = (id: string) => {
    selectedItemId = id;
    switchToRecs();
    renderCatalog(catalogContainer, allItems, selectedItemId, handleSelect);
    const recs = recommender.recommend(id, 6, 0.25);
    renderRecommendations(recsContainer, recs);

    if (graphRenderer) {
      graphRenderer.setSelectedNode(id);
    }
  };

  // Initial render
  renderCatalog(catalogContainer, allItems, null, handleSelect);
  renderRecommendations(recsContainer, []);

  // Filter Catalog
  filterInput.addEventListener('input', () => {
    const q = filterInput.value.toLowerCase().trim();
    const filtered = allItems.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q))
    );
    renderCatalog(catalogContainer, filtered, selectedItemId, handleSelect);
  });

  // Natural Language Search
  const doSearch = async () => {
    const q = searchInput.value.trim();
    if (!q) return;

    switchToRecs();
    statusTag.textContent = 'Inferencing...';
    try {
      const results = await recommender.search(q, 6, 0.2);
      renderSearchResults(recsContainer, results);
      statusTag.textContent = 'Inference complete';
    } catch (err) {
      console.error(err);
      statusTag.textContent = 'Inference error';
    }
  };

  btnSearch.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // Tab switching
  tabRecs.addEventListener('click', () => {
    tabRecs.classList.add('active');
    tabGraph.classList.remove('active');
    viewRecs.style.display = 'flex';
    viewGraph.style.display = 'none';
  });

  tabGraph.addEventListener('click', () => {
    tabGraph.classList.add('active');
    tabRecs.classList.remove('active');
    viewRecs.style.display = 'none';
    viewGraph.style.display = 'flex';

    if (!graphRenderer && canvas) {
      graphRenderer = new GraphCanvasRenderer(canvas);
      canvas.addEventListener('node-selected', (e: Event) => {
        const customEvt = e as CustomEvent<{ id: string }>;
        handleSelect(customEvt.detail.id);
      });

      const vectorItems = allItems
        .filter((it) => it.embedding && it.embedding.length > 0)
        .map((it) => ({
          id: it.id,
          title: it.title,
          category: it.category,
          embedding: it.embedding as number[] | Float32Array,
        }));

      const { nodes, edges } = generateGraphStructure(vectorItems, 0.45);
      graphRenderer.setData(nodes, edges);
    }
  });
}

bootstrap().catch(console.error);
