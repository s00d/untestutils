import type { StartedTarget } from '../start';
import type {
  ArtilleryLoadKnobs,
  ArtilleryResult,
  AutocannonResult,
  LoadMetrics,
  PerfTarget,
} from '../types';
import type { HarnessOpts } from '../ui';
import { runArtillery } from './artillery';
import { runAutocannon } from './autocannon';
import {
  buildArtilleryScript,
  describeArtilleryLoad,
  isArtilleryKnobs,
} from './script';

function resolveArtilleryKnobs(
  artillery: NonNullable<PerfTarget['load']>['artillery'],
  loadPaths?: string[],
): ArtilleryLoadKnobs {
  if (artillery === true || artillery === undefined) {
    return { paths: loadPaths };
  }
  if (isArtilleryKnobs(artillery)) {
    return {
      ...artillery,
      paths: artillery.paths?.length ? artillery.paths : loadPaths,
    };
  }
  return { paths: loadPaths };
}

/**
 * Run configured load tools.
 * Primary top-level metrics prefer Artillery when both are present
 * (multi-URL / knobs path); Autocannon remains on `load.autocannon`.
 */
export async function runLoadPhase(opts: {
  target: PerfTarget;
  started: StartedTarget;
  artifactsDir: string;
} & HarnessOpts): Promise<LoadMetrics> {
  const { target, started, artifactsDir, ui } = opts;
  const load = target.load;
  if (!load) return started.takeProcessMetrics();

  started.noteProcess();

  let autocannon: AutocannonResult | undefined;
  if (load.autocannon) {
    const ac = load.autocannon === true ? {} : load.autocannon;
    ui?.emit({
      type: 'phase',
      phase: 'autocannon',
      detail: `${ac.connections ?? 10}c×${ac.durationSec ?? 5}s`,
    });
    autocannon = await runAutocannon({
      url: started.url,
      connections: ac.connections,
      durationSec: ac.durationSec,
      artifactsDir,
      name: target.id,
    });
    started.noteProcess();
  }

  let artillery: ArtilleryResult | undefined;
  if (load.artillery) {
    const art = load.artillery;
    if (typeof art === 'object' && art && 'script' in art) {
      ui?.emit({ type: 'phase', phase: 'artillery', detail: 'inline script' });
      artillery = await runArtillery({
        script: art.script,
        artifactsDir,
        name: target.id,
        cwd: target.root,
        targetUrl: started.url,
        ui,
      });
    } else if (typeof art === 'object' && art && 'config' in art) {
      ui?.emit({ type: 'phase', phase: 'artillery', detail: art.config });
      artillery = await runArtillery({
        configPath: art.config,
        artifactsDir,
        name: target.id,
        cwd: target.root,
        targetUrl: started.url,
        ui,
      });
    } else {
      const knobs = resolveArtilleryKnobs(art, load.paths);
      ui?.emit({
        type: 'phase',
        phase: 'artillery',
        detail: describeArtilleryLoad(knobs),
      });
      artillery = await runArtillery({
        script: buildArtilleryScript(knobs),
        artifactsDir,
        name: target.id,
        cwd: target.root,
        targetUrl: started.url,
        ui,
      });
    }
    started.noteProcess();
  }

  const processMetrics = started.takeProcessMetrics();

  // Primary fields: Artillery wins when both ran (documented).
  const summary = artillery?.aggregate;
  const durationSec = summary
    ? (summary.lastMetricAt - summary.firstMetricAt) / 1000
    : autocannon?.durationSec;
  const rt = summary?.summaries['http.response_time'];

  const httpRequests = summary?.counters['http.requests'] as number | undefined;
  const http500 = (summary?.counters['http.codes.500'] as number | undefined) ?? 0;
  const artilleryErrorRate =
    summary && httpRequests
      ? (http500 / httpRequests) * 100
      : undefined;

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
      artilleryErrorRate ??
      (autocannon
        ? (autocannon.errors / Math.max(1, autocannon.requests.total)) * 100
        : undefined),
    autocannon,
    artillery,
  };
}
