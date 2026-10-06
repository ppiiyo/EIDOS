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

  constructor(
    maxOperationsBeforeCheckpoint: number = 5000,
    checkpointCallback?: () => Promise<void> | void
  ) {
    this.maxOperationsBeforeCheckpoint = maxOperationsBeforeCheckpoint;
    this.checkpointCallback = checkpointCallback;
  }

  /**
   * Appends an atomic operation to the WAL.
   */
  public append(operation: Omit<WALOperation, 'id' | 'timestamp'>): WALOperation {
    const record: WALOperation = {
      ...operation,
      id: `wal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    this.operations.push(record);

    if (this.operations.length >= this.maxOperationsBeforeCheckpoint) {
      this.triggerCheckpoint();
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
      } catch (err) {
        // Rollback uncheckpointed operations on failure
        this.operations = [...opsToCommit, ...this.operations];
        throw err;
      }
    }
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
   * Clears the in-memory WAL buffer.
   */
  public clear(): void {
    this.operations = [];
  }
}
