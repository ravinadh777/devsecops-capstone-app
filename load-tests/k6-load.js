// k6 load profile for the KEDA scaling demo.
// Run on the EC2 host:  scripts/load-test.sh   (wraps the grafana/k6 container)
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warm up
    { duration: '2m', target: 40 },    // ramp: KEDA should scale out
    { duration: '2m', target: 40 },    // hold
    { duration: '30s', target: 0 }     // ramp down: KEDA scales in after cooldown
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // <1% errors, even while pods are added
    http_req_duration: ['p(95)<800']
  }
};

export default function () {
  const list = http.get(`${BASE}/api/tasks`);
  check(list, { 'list 200': (r) => r.status === 200 });
  const work = http.get(`${BASE}/load?ms=40`);
  check(work, { 'load 200': (r) => r.status === 200 });
  sleep(0.2);
}
