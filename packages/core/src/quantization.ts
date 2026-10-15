import { QuantizedVector } from './types';

/**
 * ScalarQuantizer performs symmetric INT8 scalar quantization of dense FP32 vectors.
 * Reduces in-memory representation by 75% (4x compression) and accelerates similarity
 * computations using integer dot-product accumulation.
 */
export class ScalarQuantizer {
  /**
   * Quantizes an FP32 vector into a signed 8-bit integer array.
   *
   * @param vector - Source Float32Array vector
   * @param id - Optional identifier associated with vector
   * @returns QuantizedVector with Int8Array data and scale factor
   */
  public static quantize(vector: Float32Array, id?: string): QuantizedVector {
    let maxAbs = 0;
    let sumSq = 0;
    const len = vector.length;

    for (let i = 0; i < len; i++) {
      const val = vector[i];
      const abs = Math.abs(val);
      if (abs > maxAbs) {
        maxAbs = abs;
      }
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq);
    const scale = maxAbs > 1e-12 ? maxAbs / 127.0 : 1.0;
    const invScale = 1.0 / scale;
    const data = new Int8Array(len);

    for (let i = 0; i < len; i++) {
      // Clamp between -127 and 127
      const q = Math.round(vector[i] * invScale);
      data[i] = Math.max(-127, Math.min(127, q));
    }

    return {
      id,
      data,
      scale,
      norm: norm > 1e-12 ? norm : 1.0,
    };
  }

  /**
   * Dequantizes an INT8 quantized vector back to an FP32 representation.
   *
   * @param q - QuantizedVector
   * @returns Reconstructed Float32Array
   */
  public static dequantize(q: QuantizedVector): Float32Array {
    const len = q.data.length;
    const result = new Float32Array(len);
    const scale = q.scale;

    for (let i = 0; i < len; i++) {
      result[i] = q.data[i] * scale;
    }

    return result;
  }

  /**
   * Fast integer dot product between two quantized vectors.
   *
   * @param a - First quantized vector
   * @param b - Second quantized vector
   * @returns Approximate dot product
   */
  public static dotProduct(a: QuantizedVector, b: QuantizedVector): number {
    let intAcc = 0;
    const len = Math.min(a.data.length, b.data.length);
    const dataA = a.data;
    const dataB = b.data;

    for (let i = 0; i < len; i++) {
      intAcc += dataA[i] * dataB[i];
    }

    return intAcc * (a.scale * b.scale);
  }

  /**
   * Computes approximate cosine similarity between two quantized vectors.
   *
   * @param a - First quantized vector
   * @param b - Second quantized vector
   * @returns Cosine similarity bounded in [-1, 1]
   */
  public static cosineSimilarity(a: QuantizedVector, b: QuantizedVector): number {
    const dot = this.dotProduct(a, b);
    const denominator = a.norm * b.norm;
    if (denominator <= 1e-12) {
      return 0.0;
    }
    const sim = dot / denominator;
    return Math.max(-1.0, Math.min(1.0, sim));
  }
}
