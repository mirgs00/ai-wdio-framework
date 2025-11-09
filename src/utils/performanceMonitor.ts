export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface PerformanceSummary {
  totalDuration: number;
  metricCount: number;
  averageDuration: number;
  slowestOperation: { name: string; duration: number } | null;
  fastestOperation: { name: string; duration: number } | null;
  operations: Map<string, { count: number; totalTime: number; averageTime: number }>;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static timers: Map<string, number> = new Map();

  static startTimer(operationName: string): void {
    PerformanceMonitor.timers.set(operationName, Date.now());
  }

  static endTimer(operationName: string): PerformanceMetric {
    const startTime = PerformanceMonitor.timers.get(operationName);

    if (!startTime) {
      console.warn(`Timer "${operationName}" was not started`);
      return {
        name: operationName,
        duration: 0,
        startTime: 0,
        endTime: Date.now(),
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      name: operationName,
      duration,
      startTime,
      endTime,
    };

    PerformanceMonitor.metrics.push(metric);
    PerformanceMonitor.timers.delete(operationName);

    return metric;
  }

  static measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    PerformanceMonitor.startTimer(operationName);

    return fn()
      .then((result) => {
        const metric = PerformanceMonitor.endTimer(operationName);
        return { result, duration: metric.duration };
      })
      .catch((error) => {
        PerformanceMonitor.endTimer(operationName);
        throw error;
      });
  }

  static measure<T>(operationName: string, fn: () => T): { result: T; duration: number } {
    PerformanceMonitor.startTimer(operationName);

    try {
      const result = fn();
      const metric = PerformanceMonitor.endTimer(operationName);
      return { result, duration: metric.duration };
    } catch (error) {
      PerformanceMonitor.endTimer(operationName);
      throw error;
    }
  }

  static getMetrics(): PerformanceMetric[] {
    return [...PerformanceMonitor.metrics];
  }

  static getSummary(): PerformanceSummary {
    const metrics = PerformanceMonitor.metrics;

    if (metrics.length === 0) {
      return {
        totalDuration: 0,
        metricCount: 0,
        averageDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        operations: new Map(),
      };
    }

    const operations = new Map<string, { count: number; totalTime: number; averageTime: number }>();
    let totalDuration = 0;
    let slowestOperation: { name: string; duration: number } | null = null;
    let fastestOperation: { name: string; duration: number } | null = null;

    for (const metric of metrics) {
      totalDuration += metric.duration;

      // Track slowest and fastest
      if (!slowestOperation || metric.duration > slowestOperation.duration) {
        slowestOperation = { name: metric.name, duration: metric.duration };
      }

      if (!fastestOperation || metric.duration < fastestOperation.duration) {
        fastestOperation = { name: metric.name, duration: metric.duration };
      }

      // Aggregate by operation name
      const existing = operations.get(metric.name) || { count: 0, totalTime: 0, averageTime: 0 };
      existing.count += 1;
      existing.totalTime += metric.duration;
      existing.averageTime = existing.totalTime / existing.count;
      operations.set(metric.name, existing);
    }

    return {
      totalDuration,
      metricCount: metrics.length,
      averageDuration: totalDuration / metrics.length,
      slowestOperation,
      fastestOperation,
      operations,
    };
  }

  static clear(): void {
    PerformanceMonitor.metrics = [];
    PerformanceMonitor.timers.clear();
  }

  static formatSummary(summary: PerformanceSummary): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('╔════════════════════════════════════════╗');
    lines.push('║     PERFORMANCE SUMMARY                ║');
    lines.push('╚════════════════════════════════════════╝');
    lines.push(`Total Duration: ${summary.totalDuration}ms`);
    lines.push(`Operations: ${summary.metricCount}`);
    lines.push(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
    lines.push('');

    if (summary.slowestOperation) {
      lines.push(
        `Slowest: ${summary.slowestOperation.name} (${summary.slowestOperation.duration}ms)`
      );
    }

    if (summary.fastestOperation) {
      lines.push(
        `Fastest: ${summary.fastestOperation.name} (${summary.fastestOperation.duration}ms)`
      );
    }

    if (summary.operations.size > 0) {
      lines.push('');
      lines.push('Operation Breakdown:');
      for (const [name, stats] of Array.from(summary.operations.entries()).sort(
        (a, b) => b[1].totalTime - a[1].totalTime
      )) {
        lines.push(
          `  ${name}: ${stats.count}x, Total: ${stats.totalTime}ms, Avg: ${stats.averageTime.toFixed(2)}ms`
        );
      }
    }

    lines.push('');
    lines.push('╚════════════════════════════════════════╝');
    lines.push('');

    return lines.join('\n');
  }
}
