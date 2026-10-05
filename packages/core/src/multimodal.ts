import { cosineSimilarity } from './cosine';
import { MultimodalItem } from './types';

/**
 * Multimodal Embedding & Retrieval Engine.
 * Supports joint vision-language latent space representations (SigLIP / CLIP inspired).
 */
export class MultimodalEmbedder {
  /**
   * Projects text and image feature vectors into a balanced joint latent embedding:
   * v_joint = normalize(alpha * v_text + (1 - alpha) * v_image)
   */
  public static fuseJointEmbedding(
    textEmbedding: Float32Array,
    imageEmbedding: Float32Array,
    textWeight: number = 0.55
  ): Float32Array {
    const dim = Math.min(textEmbedding.length, imageEmbedding.length);
    const joint = new Float32Array(dim);

    const imageWeight = 1.0 - textWeight;
    for (let i = 0; i < dim; i++) {
      joint[i] = textWeight * textEmbedding[i] + imageWeight * imageEmbedding[i];
    }

    // L2 Normalization
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      sumSq += joint[i] * joint[i];
    }
    const norm = Math.sqrt(sumSq) || 1e-7;
    for (let i = 0; i < dim; i++) {
      joint[i] /= norm;
    }

    return joint;
  }

  /**
   * Calculates cross-modal similarity between text query and visual items.
   */
  public static matchTextToVisualItems(
    textQueryVector: Float32Array,
    items: MultimodalItem[],
    k: number = 5
  ): Array<{ item: MultimodalItem; score: number }> {
    const scored = items.map((item) => {
      const targetVec = item.jointEmbedding || item.imageEmbedding || item.textEmbedding;
      if (!targetVec) return { item, score: 0 };
      const score = cosineSimilarity(Array.from(textQueryVector), Array.from(targetVec));
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}
