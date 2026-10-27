export class PrometheusRegistry {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private readonly buckets = [1, 5, 10, 25, 50, 100, 250, 500];

  incCounter(name: string, labels: Record<string, string> = {}, val = 1): void {
    const key = this.formatKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + val);
  }

  observeHistogram(name: string, val: number): void {
    const list = this.histograms.get(name) ?? [];
    list.push(val);
    this.histograms.set(name, list);
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return name;
    return `${name}{${entries.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  serialize(): string {
    const lines: string[] = [];
    for (const [key, val] of this.counters.entries()) {
      const baseName = key.split('{')[0];
      lines.push(`# TYPE ${baseName} counter`, `${key} ${val}`);
    }
    for (const [name, vals] of this.histograms.entries()) {
      lines.push(`# TYPE ${name} histogram`);
      let sum = 0;
      for (const v of vals) sum += v;
      for (const b of this.buckets) {
        const count = vals.filter((v) => v <= b).length;
        lines.push(`${name}_bucket{le="${b}"} ${count}`);
      }
      lines.push(
        `${name}_bucket{le="+Inf"} ${vals.length}`,
        `${name}_sum ${sum.toFixed(3)}`,
        `${name}_count ${vals.length}`
      );
    }
    return lines.join('\n') + '\n';
  }
}
