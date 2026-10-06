import { HNSWIndex } from '../hnsw';
import { QuantizedVector } from '../types';

export const HNSW_MAGIC_HEADER = 0x45494453; // 'EIDS'
export const HNSW_FORMAT_VERSION = 1;

export interface SerializedNodeDTO {
  id: string;
  level: number;
  vector: Float32Array;
  friends: string[][];
  quantized?: QuantizedVector;
}

/**
 * High-performance binary serializer and deserializer for HNSWIndex.
 * Employs Little-Endian encoding and zero-copy TypedArray slicing.
 */
export class HNSWIndexSerializer {
  /**
   * Serializes an in-memory HNSWIndex into a compact binary buffer.
   */
  public static serialize(index: HNSWIndex): Uint8Array {
    const nodes = index.getAllNodes();
    const config = index.getConfig();
    const entryId = index.getEntryPointId() || '';
    const encoder = new TextEncoder();

    // 1. Calculate required buffer byte length
    // Header: Magic (4) + Version (4) + M (4) + M0 (4) + efConst (4) + efSearch (4) + useQuant (1) + maxLevel (4) + entryLen (2) + entryBytes + numNodes (4)
    const entryIdBytes = encoder.encode(entryId);
    let totalBytes = 4 + 4 + 4 + 4 + 4 + 4 + 1 + 4 + 2 + entryIdBytes.length + 4;

    const encodedNodes: Array<{
      idBytes: Uint8Array;
      level: number;
      vectorBytes: Uint8Array;
      friendsData: Uint8Array[];
      quantized?: { scale: number; norm: number; dataBytes: Uint8Array };
    }> = [];

    for (const node of nodes) {
      const idBytes = encoder.encode(node.id);
      const vecBytes = new Uint8Array(node.vector.buffer, node.vector.byteOffset, node.vector.byteLength);

      const friendsData: Uint8Array[] = [];
      let friendsBytesCount = 0;
      for (let l = 0; l <= node.level; l++) {
        const fList = node.friends[l] || [];
        const fJson = encoder.encode(JSON.stringify(fList));
        friendsData.push(fJson);
        friendsBytesCount += 2 + fJson.length;
      }

      let qInfo: { scale: number; norm: number; dataBytes: Uint8Array } | undefined;
      let qBytesCount = 1; // hasQuantized flag
      if (node.quantized) {
        const qData = new Uint8Array(node.quantized.data.buffer, node.quantized.data.byteOffset, node.quantized.data.byteLength);
        qInfo = {
          scale: node.quantized.scale,
          norm: node.quantized.norm,
          dataBytes: qData,
        };
        qBytesCount += 4 + 4 + 4 + qData.length; // scale(4) + norm(4) + len(4) + data
      }

      // Per node: idLen (2) + idBytes + level (1) + vecLen (4) + vecBytes + friendsBytesCount + qBytesCount
      const nodeBytes = 2 + idBytes.length + 1 + 4 + vecBytes.length + 1 + friendsBytesCount + qBytesCount;
      totalBytes += nodeBytes;

      encodedNodes.push({
        idBytes,
        level: node.level,
        vectorBytes: vecBytes,
        friendsData,
        quantized: qInfo,
      });
    }

    // 2. Allocate and write Little-Endian binary data
    const buffer = new Uint8Array(totalBytes);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    // Header
    view.setUint32(offset, HNSW_MAGIC_HEADER, true); offset += 4;
    view.setUint32(offset, HNSW_FORMAT_VERSION, true); offset += 4;
    view.setUint32(offset, config.M, true); offset += 4;
    view.setUint32(offset, config.M0, true); offset += 4;
    view.setUint32(offset, config.efConstruction, true); offset += 4;
    view.setUint32(offset, config.efSearch, true); offset += 4;
    view.setUint8(offset, config.useQuantization ? 1 : 0); offset += 1;
    view.setInt32(offset, index.getMaxLevel(), true); offset += 4;

    view.setUint16(offset, entryIdBytes.length, true); offset += 2;
    buffer.set(entryIdBytes, offset); offset += entryIdBytes.length;

    view.setUint32(offset, nodes.length, true); offset += 4;

    // Nodes
    for (const item of encodedNodes) {
      view.setUint16(offset, item.idBytes.length, true); offset += 2;
      buffer.set(item.idBytes, offset); offset += item.idBytes.length;

      view.setUint8(offset, item.level); offset += 1;

      view.setUint32(offset, item.vectorBytes.length, true); offset += 4;
      buffer.set(item.vectorBytes, offset); offset += item.vectorBytes.length;

      // Friends per level
      view.setUint8(offset, item.friendsData.length); offset += 1;
      for (const fBytes of item.friendsData) {
        view.setUint16(offset, fBytes.length, true); offset += 2;
        buffer.set(fBytes, offset); offset += fBytes.length;
      }

      // Quantized payload
      if (item.quantized) {
        view.setUint8(offset, 1); offset += 1;
        view.setFloat32(offset, item.quantized.scale, true); offset += 4;
        view.setFloat32(offset, item.quantized.norm, true); offset += 4;
        view.setUint32(offset, item.quantized.dataBytes.length, true); offset += 4;
        buffer.set(item.quantized.dataBytes, offset); offset += item.quantized.dataBytes.length;
      } else {
        view.setUint8(offset, 0); offset += 1;
      }
    }

    return buffer;
  }

  /**
   * Deserializes a binary buffer back into an operational HNSWIndex.
   */
  public static deserialize(buffer: Uint8Array): HNSWIndex {
    if (buffer.length < 24) {
      throw new Error('Invalid HNSW binary buffer: unexpected EOF in header.');
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const decoder = new TextDecoder();
    let offset = 0;

    const magic = view.getUint32(offset, true); offset += 4;
    if (magic !== HNSW_MAGIC_HEADER) {
      throw new Error(`Invalid HNSW magic header: expected 0x${HNSW_MAGIC_HEADER.toString(16)}, got 0x${magic.toString(16)}`);
    }

    const version = view.getUint32(offset, true); offset += 4;
    if (version !== HNSW_FORMAT_VERSION) {
      throw new Error(`Unsupported HNSW format version: ${version}`);
    }

    const M = view.getUint32(offset, true); offset += 4;
    const M0 = view.getUint32(offset, true); offset += 4;
    const efConstruction = view.getUint32(offset, true); offset += 4;
    const efSearch = view.getUint32(offset, true); offset += 4;
    const useQuantization = view.getUint8(offset) === 1; offset += 1;
    const maxLevel = view.getInt32(offset, true); offset += 4;

    const entryIdLen = view.getUint16(offset, true); offset += 2;
    const entryId = decoder.decode(buffer.subarray(offset, offset + entryIdLen));
    offset += entryIdLen;

    const numNodes = view.getUint32(offset, true); offset += 4;

    const index = new HNSWIndex({
      M,
      M0,
      efConstruction,
      efSearch,
      useQuantization,
    });

    const parsedNodes: SerializedNodeDTO[] = [];

    for (let i = 0; i < numNodes; i++) {
      const idLen = view.getUint16(offset, true); offset += 2;
      const id = decoder.decode(buffer.subarray(offset, offset + idLen)); offset += idLen;

      const level = view.getUint8(offset); offset += 1;

      const vecBytesLen = view.getUint32(offset, true); offset += 4;
      const vecSlice = buffer.slice(offset, offset + vecBytesLen); offset += vecBytesLen;
      const vector = new Float32Array(vecSlice.buffer, vecSlice.byteOffset, vecSlice.byteLength / 4);

      const numLevels = view.getUint8(offset); offset += 1;
      const friends: string[][] = [];
      for (let l = 0; l < numLevels; l++) {
        const fLen = view.getUint16(offset, true); offset += 2;
        const fStr = decoder.decode(buffer.subarray(offset, offset + fLen)); offset += fLen;
        friends.push(JSON.parse(fStr));
      }

      const hasQuant = view.getUint8(offset) === 1; offset += 1;
      let quantized: QuantizedVector | undefined;
      if (hasQuant) {
        const scale = view.getFloat32(offset, true); offset += 4;
        const norm = view.getFloat32(offset, true); offset += 4;
        const qDataLen = view.getUint32(offset, true); offset += 4;
        const qSlice = buffer.slice(offset, offset + qDataLen); offset += qDataLen;
        const data = new Int8Array(qSlice.buffer, qSlice.byteOffset, qSlice.byteLength);
        quantized = { id, scale, norm, data };
      }

      parsedNodes.push({ id, level, vector, friends, quantized });
    }

    index.restoreInternalState(parsedNodes, entryId || null, maxLevel);
    return index;
  }
}
