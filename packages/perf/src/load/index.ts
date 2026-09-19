import type { StartedTarget } from '../start';
import type { LoadMetrics, PerfTarget } from '../types';
import { runArtillery } from './artillery';
import { runAutocannon } from './autocannon';

export async function runLoadPhase(opts: {
  target: PerfTarget;
  started: StartedTarget;
  artifactsDir: string;
}): Promise<LoadMetrics> {
  const { target, started, artifactsDir } = opts;
  const load = target.load;
  if (!load) return started.takeProcessMetrics();

  let autocannon;
  if (load.autocannon) {
    const ac = load.autocannon === true ? {} : load.autocannon;
    console.log(
      `  → autocannon ${ac.connections ?? 10}c × ${ac.durationSec ?? 10}s @ ${started.url}`,
    );
    autocannon = await runAutocannon({
      url: started.url,
      connections: ac.connections,
      durationSec: ac.durationSec,
      artifactsDir,
      name: target.id,
    });
  }

  let artillery;
  if (load.artillery?.config) {
    console.log(`  → artillery ${load.artillery.config}`);
    artillery = await runArtillery({
      configPath: load.artillery.config,
      artifactsDir,
      name: target.id,
      cwd: target.root,
      targetUrl: started.url,
    });
  }

  // After load tools finish — sampling ran throughout autocannon/artillery.
  const processMetrics = started.takeProcessMetrics();

  const summary = artillery?.aggregate;
  const durationSec = summary ? (summary.lastMetricAt - summary.firstMetricAt) / 1000 : undefined;
  const rt = summary?.summaries['http.response_time'];

  return {
    ...processMetrics,
    durationSec,
    responseTimeAvg: rt?.mean ?? autocannon?.latency.average,
    responseTimeMin: rt?.min ?? autocannon?.latency.min,
    responseTimeMax: rt?.max ?? autocannon?.latency.max,
    responseTimeP50: rt?.p50 ?? autocannon?.latency.p50,
    responseTimeP95: rt?.p95 ?? autocannon?.latency.p97_5,
    responseTimeP99: rt?.p99 ?? autocannon?.latency.p99,
    requestsPerSecond: summary?.rates['http.request_rate'] ?? autocannon?.requests.average,
    errorRate:
      summary?.counters['http.codes.500'] && summary?.counters['http.requests']
        ? ((summary.counters['http.codes.500'] as number) /
            (summary.counters['http.requests'] as number)) *
          100
        : autocannon
          ? (autocannon.errors / Math.max(1, autocannon.requests.total)) * 100
          : undefined,
    autocannon,
    artillery,
  };
}
