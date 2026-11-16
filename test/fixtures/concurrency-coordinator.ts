import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import type { ChangeRequest } from '../../src/domain/change-request';

export interface WorkerOptions {
  filename: string; issuer: string; id: string; subject: string;
  operation: 'edit' | 'submit' | 'approve' | 'request-changes' | 'revoke' | 'lock';
  version: string;
  content?: { title: string; description: string; reason: string };
  holdAfterLock?: boolean; holdBeforeCommit?: boolean; failBeforeCommit?: boolean;
}
export interface WorkerEvent {
  type: 'ready' | 'attempt' | 'locked' | 'written' | 'committed' | 'result';
  threadId: number; operation: WorkerOptions['operation'];
  code?: string; row?: ChangeRequest | null; isReviewer?: boolean | null; elapsedMs?: number;
  busyTimeout?: number;
}

export class ControlledWorker {
  private readonly gates = new Int32Array(new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT));
  private readonly worker: Worker;
  readonly events: WorkerEvent[] = [];
  private readonly waiters = new Set<() => void>();
  private failure?: Error;

  constructor(options: WorkerOptions) {
    this.worker = new Worker(join(__dirname, 'concurrency-worker.ts'), {
      execArgv: ['--require', 'tsx/cjs'], workerData: { ...options, gates: this.gates.buffer },
    });
    this.worker.on('message', (event: WorkerEvent) => { this.events.push(event); this.notify(); });
    this.worker.on('error', error => { this.failure = error; this.notify(); });
    this.worker.on('exit', code => {
      if (!this.events.some(event => event.type === 'result')) this.failure ??= new Error(`worker پیش از نتیجه خارج شد؛ کد ${code}`);
      this.notify();
    });
  }
  private notify(): void { for (const notify of [...this.waiters]) notify(); }
  phase(type: WorkerEvent['type']): Promise<WorkerEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(check); reject(new Error(`مهلت انتظار مرحلهٔ ${type} پایان یافت.`)); }, 15000);
      const check = () => {
        const event = this.events.find(event => event.type === type);
        if (event || this.failure) {
          clearTimeout(timer); this.waiters.delete(check);
          if (this.failure) reject(this.failure); else resolve(event!);
        }
      };
      this.waiters.add(check); check();
    });
  }
  release(index: 0 | 1 | 2): void { Atomics.store(this.gates, index, 1); Atomics.notify(this.gates, index); }
  start(): void { this.release(0); }
  async close(): Promise<void> { this.release(0); this.release(1); this.release(2); await this.worker.terminate(); }
}

export function recordRace(name: string, workers: ControlledWorker[], final: unknown): void {
  const directory = join(process.cwd(), 'test-results', 'us5'); mkdirSync(directory, { recursive: true });
  appendFileSync(join(directory, 'races.jsonl'), JSON.stringify({ name, at: new Date().toISOString(), workers: workers.map(worker => worker.events), final }) + '\n');
}
