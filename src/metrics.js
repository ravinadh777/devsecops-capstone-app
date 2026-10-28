'use strict';

/**
 * Minimal Prometheus text-format metrics with zero dependencies.
 * Exposes http_requests_total (used by the KEDA trigger), a latency histogram,
 * a business counter and basic process gauges.
 */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function labelString(labels) {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

function createMetrics({ appVersion = 'unknown', gitSha = 'unknown' } = {}) {
  const requests = new Map();      // key -> count
  const durations = new Map();     // route -> { buckets[], sum, count }
  let tasksCreated = 0;

  function observeRequest({ method, route, status, seconds }) {
    const key = labelString({ method, route, status: String(status) });
    requests.set(key, (requests.get(key) || 0) + 1);
    let h = durations.get(route);
    if (!h) {
      h = { buckets: new Array(BUCKETS.length).fill(0), sum: 0, count: 0 };
      durations.set(route, h);
    }
    BUCKETS.forEach((b, i) => { if (seconds <= b) h.buckets[i] += 1; });
    h.sum += seconds;
    h.count += 1;
  }

  function render() {
    const lines = [];
    lines.push('# HELP http_requests_total Total HTTP requests handled.');
    lines.push('# TYPE http_requests_total counter');
    for (const [labels, count] of requests) lines.push(`http_requests_total${labels} ${count}`);

    lines.push('# HELP http_request_duration_seconds HTTP request latency.');
    lines.push('# TYPE http_request_duration_seconds histogram');
    for (const [route, h] of durations) {
      const r = escapeLabel(route);
      BUCKETS.forEach((b, i) => lines.push(`http_request_duration_seconds_bucket{route="${r}",le="${b}"} ${h.buckets[i]}`));
      lines.push(`http_request_duration_seconds_bucket{route="${r}",le="+Inf"} ${h.count}`);
      lines.push(`http_request_duration_seconds_sum{route="${r}"} ${h.sum.toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{route="${r}"} ${h.count}`);
    }

    lines.push('# HELP tasks_created_total Tasks created since process start.');
    lines.push('# TYPE tasks_created_total counter');
    lines.push(`tasks_created_total ${tasksCreated}`);

    const mem = process.memoryUsage();
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);
    lines.push('# HELP nodejs_heap_used_bytes V8 heap used in bytes.');
    lines.push('# TYPE nodejs_heap_used_bytes gauge');
    lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
    lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);
    lines.push('# HELP app_build_info Build information; value is always 1.');
    lines.push('# TYPE app_build_info gauge');
    lines.push(`app_build_info${labelString({ version: appVersion, git_sha: gitSha })} 1`);
    return lines.join('\n') + '\n';
  }

  return {
    observeRequest,
    incTasksCreated() { tasksCreated += 1; },
    render
  };
}

module.exports = { createMetrics, BUCKETS };
