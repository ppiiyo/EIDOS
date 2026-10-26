import * as net from 'net';
import { InMemoryCache } from './in-memory-cache';

/**
 * Lightweight RESP2-compatible embedded Redis server for single-container production
 * deployments (e.g., Cloud Run / AI Studio) when no external Redis daemon is bound to 6379.
 * If an external redis-server is already listening on 6379, this server gracefully no-ops
 * and can automatically take over if the previous listener exits.
 */
export class EmbeddedRedisServer {
  private server: net.Server | null = null;
  private store: InMemoryCache;
  private listening = false;

  constructor(store: InMemoryCache) {
    this.store = store;
  }

  public start(port: number = 6379, host: string = '127.0.0.1'): void {
    if (this.server && this.listening) return;

    if (this.server && !this.listening) {
      try {
        this.server.removeAllListeners();
        this.server.close();
      } catch {
        // Ignore cleanup errors
      }
      this.server = null;
    }

    const srv = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let cmdQueue: Promise<void> = Promise.resolve();

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length > 0) {
          const parsed = this.parseRespCommand(buffer);
          if (!parsed) break;
          buffer = buffer.subarray(parsed.bytesConsumed);
          const args = parsed.args;
          cmdQueue = cmdQueue
            .then(() => this.handleCommand(socket, args))
            .catch(() => {
              // Ignore socket write errors after close
            });
        }
      });

      socket.on('error', () => {
        // Ignore client socket errors
      });
    });

    srv.on('error', () => {
      // Port 6379 is already occupied by an external redis-server or sibling worker; allow future re-bind
      this.listening = false;
      this.server = null;
    });

    srv.on('close', () => {
      this.listening = false;
      this.server = null;
    });

    srv.listen(port, host, () => {
      this.listening = true;
    });

    if (typeof srv.unref === 'function') {
      srv.unref();
    }

    this.server = srv;
  }

  public isListening(): boolean {
    return this.listening;
  }

  private parseRespCommand(buf: Buffer): { args: string[]; bytesConsumed: number } | null {
    if (buf.length === 0) return null;

    // Inline command (e.g., "PING\r\n")
    if (buf[0] !== 0x2a /* '*' */) {
      const idx = buf.indexOf('\r\n');
      if (idx === -1) return null;
      const line = buf.subarray(0, idx).toString('utf8').trim();
      const args = line ? line.split(/\s+/) : [];
      return { args, bytesConsumed: idx + 2 };
    }

    // Multibulk RESP array "*<count>\r\n"
    const firstCrlf = buf.indexOf('\r\n');
    if (firstCrlf === -1) return null;
    const count = parseInt(buf.subarray(1, firstCrlf).toString('utf8'), 10);
    if (Number.isNaN(count) || count <= 0) {
      return { args: [], bytesConsumed: firstCrlf + 2 };
    }

    let offset = firstCrlf + 2;
    const args: string[] = [];

    for (let i = 0; i < count; i++) {
      if (offset >= buf.length) return null;
      if (buf[offset] !== 0x24 /* '$' */) return null;
      const lenEnd = buf.indexOf('\r\n', offset);
      if (lenEnd === -1) return null;
      const strLen = parseInt(buf.subarray(offset + 1, lenEnd).toString('utf8'), 10);
      offset = lenEnd + 2;
      if (strLen < 0) {
        args.push('');
        continue;
      }
      if (offset + strLen + 2 > buf.length) return null;
      const val = buf.subarray(offset, offset + strLen).toString('utf8');
      args.push(val);
      offset += strLen + 2;
    }

    return { args, bytesConsumed: offset };
  }

  private async handleCommand(socket: net.Socket, args: string[]): Promise<void> {
    if (args.length === 0 || socket.destroyed) return;
    const cmd = args[0].toUpperCase();

    try {
      switch (cmd) {
        case 'PING': {
          const msg = args[1];
          if (msg !== undefined) {
            this.writeBulkString(socket, msg);
          } else {
            socket.write('+PONG\r\n');
          }
          break;
        }
        case 'AUTH':
        case 'SELECT':
        case 'CLIENT':
        case 'HELLO':
        case 'READONLY': {
          socket.write('+OK\r\n');
          break;
        }
        case 'COMMAND': {
          socket.write('*0\r\n');
          break;
        }
        case 'INFO': {
          const stats = await this.store.getStats();
          const info = [
            '# Server',
            'redis_version:7.2.4',
            'redis_mode:standalone',
            '# Memory',
            `used_memory:${stats.memoryUsageMB * 1024 * 1024}`,
            `used_memory_human:${stats.memory}`,
            '# Keyspace',
            `db0:keys=${stats.keys},expires=${stats.keys},avg_ttl=300000`,
          ].join('\r\n');
          this.writeBulkString(socket, info);
          break;
        }
        case 'DBSIZE': {
          const stats = await this.store.getStats();
          socket.write(`:${stats.keys}\r\n`);
          break;
        }
        case 'GET': {
          const key = args[1] || '';
          const val = await this.store.get<string>(key);
          if (val === null || val === undefined) {
            socket.write('$-1\r\n');
          } else {
            const serialized = typeof val === 'string' ? val : JSON.stringify(val);
            this.writeBulkString(socket, serialized);
          }
          break;
        }
        case 'SET': {
          const key = args[1] || '';
          const val = args[2] || '';
          let ttl = 300;
          let nx = false;
          let xx = false;
          for (let i = 3; i < args.length; i++) {
            const flag = args[i].toUpperCase();
            if (flag === 'EX' && args[i + 1]) {
              ttl = parseInt(args[i + 1], 10) || 300;
              i++;
            } else if (flag === 'PX' && args[i + 1]) {
              ttl = Math.max(1, Math.ceil((parseInt(args[i + 1], 10) || 300000) / 1000));
              i++;
            } else if (flag === 'NX') {
              nx = true;
            } else if (flag === 'XX') {
              xx = true;
            }
          }
          if (nx || xx) {
            const existing = await this.store.get(key);
            const exists = existing !== null && existing !== undefined;
            if ((nx && exists) || (xx && !exists)) {
              socket.write('$-1\r\n');
              break;
            }
          }
          await this.store.set(key, val, ttl);
          socket.write('+OK\r\n');
          break;
        }
        case 'SETEX': {
          const key = args[1] || '';
          const ttl = parseInt(args[2] || '300', 10) || 300;
          const val = args[3] || '';
          await this.store.set(key, val, ttl);
          socket.write('+OK\r\n');
          break;
        }
        case 'SETNX': {
          const key = args[1] || '';
          const val = args[2] || '';
          const existing = await this.store.get(key);
          if (existing !== null && existing !== undefined) {
            socket.write(':0\r\n');
          } else {
            await this.store.set(key, val, 300);
            socket.write(':1\r\n');
          }
          break;
        }
        case 'EXPIRE': {
          const key = args[1] || '';
          const ttl = parseInt(args[2] || '300', 10) || 300;
          const existing = await this.store.get(key);
          if (existing !== null && existing !== undefined) {
            await this.store.set(key, existing, ttl);
            socket.write(':1\r\n');
          } else {
            socket.write(':0\r\n');
          }
          break;
        }
        case 'TTL': {
          const key = args[1] || '';
          const ttlSec = await this.store.ttl(key);
          socket.write(`:${ttlSec}\r\n`);
          break;
        }
        case 'PTTL': {
          const key = args[1] || '';
          const pttlMs = await this.store.pttl(key);
          socket.write(`:${pttlMs}\r\n`);
          break;
        }
        case 'DEL':
        case 'UNLINK': {
          const keys = args.slice(1);
          let deleted = 0;
          for (const k of keys) {
            const existed = (await this.store.get(k)) !== null;
            await this.store.del(k);
            if (existed) deleted++;
          }
          socket.write(`:${deleted}\r\n`);
          break;
        }
        case 'SCAN': {
          let pattern = '*';
          for (let i = 2; i < args.length; i++) {
            if (args[i].toUpperCase() === 'MATCH' && args[i + 1]) {
              pattern = args[i + 1];
              i++;
            }
          }
          const matchedKeys = this.store.keysMatching(pattern);
          let resp = `*2\r\n$1\r\n0\r\n*${matchedKeys.length}\r\n`;
          for (const k of matchedKeys) {
            const bLen = Buffer.byteLength(k, 'utf8');
            resp += `$${bLen}\r\n${k}\r\n`;
          }
          socket.write(resp);
          break;
        }
        case 'FLUSHDB':
        case 'FLUSHALL': {
          this.store.clearSync();
          socket.write('+OK\r\n');
          break;
        }
        case 'QUIT': {
          socket.write('+OK\r\n');
          socket.end();
          break;
        }
        default: {
          socket.write('+OK\r\n');
          break;
        }
      }
    } catch {
      socket.write('-ERR internal command error\r\n');
    }
  }

  private writeBulkString(socket: net.Socket, str: string): void {
    const byteLen = Buffer.byteLength(str, 'utf8');
    socket.write(`$${byteLen}\r\n${str}\r\n`);
  }
}

let embeddedServerInstance: EmbeddedRedisServer | null = null;

export function ensureEmbeddedRedisServer(store: InMemoryCache, port: number = 6379): EmbeddedRedisServer {
  if (!embeddedServerInstance) {
    embeddedServerInstance = new EmbeddedRedisServer(store);
  }
  if (!embeddedServerInstance.isListening()) {
    embeddedServerInstance.start(port);
  }
  return embeddedServerInstance;
}
