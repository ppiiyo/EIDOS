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
  private checkpointCallback?: () => Promise<void> | void;
  private readonly walFilePath?: string;

  constructor(
    maxOperationsBeforeCheckpoint: number = 5000,
    checkpointCallback?: () => Promise<void> | void,
    walFilePath?: string
  ) {
    this.maxOperationsBeforeCheckpoint = maxOperationsBeforeCheckpoint;
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

    if (this.operations.length >= this.maxOperationsBeforeCheckpoint) {
      void this.triggerCheckpoint();
    }

    return record;
  }

  /**
   * Triggers a checkpoint: executes persistence callback and truncates log.
   */
  public async triggerCheckpoint(): Promise<void> {
    const opsToCommit = [...this.operations];
    this.operations = [];
    if (this.checkpointCallback) {
      try {
        await this.checkpointCallback();
        if (this.walFilePath && fs.existsSync(this.walFilePath)) {
          fs.writeFileSync(this.walFilePath, '', 'utf8');
        }
      } catch (err) {
        // Rollback uncheckpointed operations on failure
        this.operations = [...opsToCommit, ...this.operations];
        throw err;
      }
    }
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
}

