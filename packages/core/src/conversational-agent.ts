import { CatalogItem } from './types';
import { VectorSteering } from './adaptive/vector-steering';
import { AgentDialogueMessage, AgentIntent } from './types';
import { cosineSimilarity } from './cosine';

/**
 * Conversational Catalog Agent for interactive, natural language discovery.
 * Bridges conversational dialogue with vector space operations and steering arithmetic.
 */
export class ConversationalCatalogAgent {
  private dialogueHistory: AgentDialogueMessage[] = [];

  constructor(
    private systemPrompt: string = 'Ты — интеллектуальный EIDOS ассистент по подбору товаров и семантическому поиску.'
  ) {
    this.dialogueHistory.push({
      role: 'system',
      content: this.systemPrompt,
      timestamp: Date.now(),
    });
  }

  /**
   * Parses user input string into structured Intent and vector modifiers.
   */
  public parseIntent(input: string): AgentIntent {
    const text = input.toLowerCase();
    const positiveMods: string[] = [];
    const negativeMods: string[] = [];

    // Extract price constraints (e.g. "до 15000", "< 50000")
    let maxPrice: number | undefined = undefined;
    const priceMatch = text.match(/до\s*(\d+[\s\d]*)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1].replace(/\s+/g, ''), 10);
    }

    // Positive and negative trait detection
    const positiveKeywords = ['тихий', 'белый', 'компактный', 'премиум', 'легкий', 'быстрый', 'беспроводной', 'эргономичный'];
    const negativeKeywords = ['громоздкий', 'шумный', 'дешевый', 'пластик', 'медленный', 'тяжелый', 'яркий'];

    for (const kw of positiveKeywords) {
      if (text.includes(kw)) positiveMods.push(kw);
    }

    for (const kw of negativeKeywords) {
      if (text.includes(`не ${kw}`) || text.includes(`без ${kw}`) || text.includes(kw)) {
        negativeMods.push(kw);
      }
    }

    return {
      query: input,
      maxPrice,
      positiveModifiers: positiveMods,
      negativeModifiers: negativeMods,
      requestedAction: text.includes('сравни') ? 'compare' : text.includes('почему') ? 'explain' : 'recommend',
    };
  }

  /**
   * Executes a full conversational turn:
   * Translates dialogue intent into latent vector delta modifiers, retrieves candidates,
   * and synthesizes natural language response.
   */
  public async executeTurn(
    userInput: string,
    catalog: CatalogItem[],
    resolveEmbedding: (text: string) => Float32Array
  ): Promise<AgentDialogueMessage> {
    const intent = this.parseIntent(userInput);
    const baseQueryVec = resolveEmbedding(intent.query);

    // Apply conversational vector steering
    const steeringMods = [
      ...intent.positiveModifiers.map((mod) => ({
        label: mod,
        type: 'positive' as const,
        weight: 0.5,
        vector: resolveEmbedding(mod),
      })),
      ...intent.negativeModifiers.map((mod) => ({
        label: mod,
        type: 'negative' as const,
        weight: 0.6,
        vector: resolveEmbedding(mod),
      })),
    ];

    const steeredVec = steeringMods.length > 0 ? VectorSteering.steer(baseQueryVec, steeringMods) : baseQueryVec;

    // Filter and score candidates
    let candidates = catalog;
    if (intent.maxPrice !== undefined) {
      candidates = candidates.filter((c) => (c.price ? c.price <= intent.maxPrice! : true));
    }

    const scored = candidates.map((item) => {
      const itemVec = resolveEmbedding(`${item.title} ${item.description} ${item.category} ${item.tags.join(' ')}`);
      const sim = cosineSimilarity(Array.from(steeredVec), Array.from(itemVec));
      return { item, sim };
    });

    scored.sort((a, b) => b.sim - a.sim);
    const topPicks = scored.slice(0, 3);

    // Formulate response
    const itemNames = topPicks.map((p) => `«${p.item.title}» (${(p.sim * 100).toFixed(0)}% совпадение)`).join(', ');
    let responseText = `Я проанализировал ваш запрос «${userInput}».`;

    if (steeringMods.length > 0) {
      responseText += ` Вектор смещён с учётом акцентов: [${intent.positiveModifiers.join(', ')}] и исключений: [${intent.negativeModifiers.join(', ')}].`;
    }

    if (topPicks.length > 0) {
      responseText += ` Наиболее релевантные позиции: ${itemNames}.`;
    } else {
      responseText += ' По заданным критериям ничего не найдено, попробуйте смягчить ограничения.';
    }

    const assistantMessage: AgentDialogueMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      structuredPayload: {
        recommendedItemIds: topPicks.map((p) => p.item.id),
        steeringVectorApplied: steeringMods.length > 0,
        confidence: topPicks[0]?.sim || 0.8,
      },
    };

    this.dialogueHistory.push({ role: 'user', content: userInput, timestamp: Date.now() });
    this.dialogueHistory.push(assistantMessage);

    return assistantMessage;
  }

  public getHistory(): AgentDialogueMessage[] {
    return this.dialogueHistory;
  }
}
