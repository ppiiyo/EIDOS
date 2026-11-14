import * as fs from 'fs';
import * as path from 'path';
import { HNSWIndex } from '../hnsw';

export type WALOperationType = 'INSERT_NODE' | 'DELETE_NODE' | 'UPDATE_NODE';

export interface WALOperation {
  id: string;
  type: WALOperationType;
  timestamp: number;
  nodeId: string;
  vector?: Float32Array;
  metadata?: Record<string, unknown>;
}

/**
 * Write-Ahead Log (WAL) Engine for HNSW Persistence and Fault-Tolerance.
 * Records mutations sequentially before application, allowing complete crash recovery
 * and incremental replay upon node restart.
 */
export class WriteAheadLog {
  private operations: WALOperation[] = [];
  private readonly maxOperationsBeforeCheckpoint: number;
  private readonly maxInMemoryOperations: number;
  private checkpointCallback?: () => Promise<void> | void;
  private readonly walFilePath?: string;
  private checkpointInFlight: Promise<void> | null = null;
  private failedCheckpointsCount = 0;
  private droppedInMemoryCount = 0;

  constructor(
    maxOperationsBeforeCheckpoint: number = 5000,
    checkpointCallback?: () => Promise<void> | void,
    walFilePath?: string,
    maxInMemoryOperations?: number
  ) {
    this.maxOperationsBeforeCheckpoint = maxOperationsBeforeCheckpoint;
    this.maxInMemoryOperations =
      maxInMemoryOperations ?? Math.max(maxOperationsBeforeCheckpoint * 2, 20_000);
    this.checkpointCallback = checkpointCallback;
    this.walFilePath = walFilePath || process.env.EIDOS_WAL_PATH;
  }

  /**
   * Appends an atomic operation to the WAL (and optionally flushes to disk if walFilePath is configured).
   */
  public append(operation: Omit<WALOperation, 'id' | 'timestamp'>): WALOperation {
    const record: WALOperation = {
      ...operation,
      id: `wal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    this.operations.push(record);
    if (this.operations.length > this.maxInMemoryOperations) {
      const overflow = this.operations.length - this.maxInMemoryOperations;
      this.operations.splice(0, overflow);
      this.droppedInMemoryCount += overflow;
    }

    if (this.walFilePath) {
      try {
        const dir = path.dirname(this.walFilePath);
        fs.mkdirSync(dir, { recursive: true });
        const serialized = JSON.stringify({
          ...record,
          vector: record.vector ? Array.from(record.vector) : undefined,
        });
        fs.appendFileSync(this.walFilePath, `${serialized}\n`, 'utf8');
      } catch {
        // Ignore disk errors in read-only or test environments
      }
    }

    if (this.operations.length >= this.maxOperationsBeforeCheckpoint && !this.checkpointInFlight) {
      void this.triggerCheckpoint().catch(() => {
        // Error is tracked in failedCheckpointsCount and operations are retained
      });
    }

    return record;
  }

  /**
   * Triggers a checkpoint: executes persistence callback and truncates log only on success.
   */
  public async triggerCheckpoint(): Promise<void> {
    if (this.checkpointInFlight) {
      return this.checkpointInFlight;
    }

    const run = async () => {
      const opsToCommit = [...this.operations];
      this.operations = [];
      if (this.checkpointCallback) {
        try {
          await this.checkpointCallback();
          if (this.walFilePath && fs.existsSync(this.walFilePath)) {
            fs.writeFileSync(this.walFilePath, '', 'utf8');
          }
        } catch (err) {
          this.failedCheckpointsCount += 1;
          const restored = [...opsToCommit, ...this.operations];
          if (restored.length > this.maxInMemoryOperations) {
            const overflow = restored.length - this.maxInMemoryOperations;
            this.droppedInMemoryCount += overflow;
            this.operations = restored.slice(overflow);
          } else {
            this.operations = restored;
          }
          throw err;
        }
      }
    };

    this.checkpointInFlight = run().finally(() => {
      this.checkpointInFlight = null;
    });
    return this.checkpointInFlight;
  }

  public getFailedCheckpointsCount(): number {
    return this.failedCheckpointsCount;
  }

  public getDroppedInMemoryCount(): number {
    return this.droppedInMemoryCount;
  }

  /**
   * Flushes uncommitted WAL operations immediately (e.g., during graceful shutdown).
   */
  public async flush(): Promise<void> {
    await this.triggerCheckpoint();
  }

  /**
   * Replays all logged mutations into an in-memory HNSWIndex.
   *
   * @returns Total number of replayed operations.
   */
  public replay(index: HNSWIndex): number {
    let replayed = 0;

    for (const op of this.operations) {
      switch (op.type) {
        case 'INSERT_NODE':
        case 'UPDATE_NODE':
          if (op.vector) {
            index.insert(op.nodeId, op.vector);
            replayed++;
          }
          break;
        case 'DELETE_NODE':
          index.delete(op.nodeId);
          replayed++;
          break;
      }
    }

    return replayed;
  }

  /**
   * Retrieves all uncommitted WAL operations.
   */
  public getOperations(): readonly WALOperation[] {
    return this.operations;
  }

  /**
   * Returns current uncheckpointed operation count.
   */
  public size(): number {
    return this.operations.length;
  }

  /**
   * Get current estimated log size in bytes for monitoring.
   */
  public getLogSize(): number {
    // Estimate bytes: ~100 bytes per metadata + vector length * 4
    let bytes = 0;
    for (const op of this.operations) {
      bytes += 128 + (op.vector ? op.vector.byteLength : 0);
    }
    return bytes;
  }

  /**
   * Check if log needs rotation or checkpoint.
   */
  public needsRotation(maxBytes: number = 10 * 1024 * 1024): boolean {
    return this.getLogSize() >= maxBytes || this.operations.length >= this.maxOperationsBeforeCheckpoint;
  }

  /**
   * Clears the in-memory WAL buffer.
   */
  public clear(): void {
    this.operations = [];
  }

  /**
   * Reads uncommitted WAL operations from disk file (`walFilePath`) into memory.
   */
  public loadFromDisk(customPath?: string): WALOperation[] {
    const target = customPath || this.walFilePath;
    if (!target || !fs.existsSync(target)) {
      return [];
    }
    try {
      const content = fs.readFileSync(target, 'utf8');
      const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
      const loaded: WALOperation[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          loaded.push({
            id: String(parsed.id || `wal-${Date.now()}`),
            type: parsed.type,
            timestamp: Number(parsed.timestamp || Date.now()),
            nodeId: String(parsed.nodeId),
            vector: Array.isArray(parsed.vector) ? new Float32Array(parsed.vector) : undefined,
            metadata: parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : undefined,
          });
        } catch {
          // Skip malformed trailing line from mid-write crash
        }
      }
      this.operations = loaded;
      return loaded;
    } catch {
      return [];
    }
  }

  /**
   * Truncates the on-disk WAL file after a successful snapshot write.
   */
  public truncateDisk(customPath?: string): void {
    const target = customPath || this.walFilePath;
    this.operations = [];
    if (target && fs.existsSync(target)) {
      try {
        fs.writeFileSync(target, '', 'utf8');
      } catch {
        // Ignore in read-only environments
      }
    }
  }
}

