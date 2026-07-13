// K6 Endpoint-Specific Load Tests
// Reference: Master Plan Section 7 - Load Testing

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const endpointDurations = {
  health: new Trend('endpoint_health'),
  divisions: new Trend('endpoint_divisions'),
  articles_list: new Trend('endpoint_articles_list'),
  article_get: new Trend('endpoint_article_get'),
  article_create: new Trend('endpoint_article_create'),
  article_publish: new Trend('endpoint_article_publish'),
  auth_login: new Trend('endpoint_auth_login'),
};

export const options = {
  scenarios: {
    endpoints: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 50,
      maxDuration: '5m',
    },
  },
  
  thresholds: {
    endpoint_health: ['p(95)<100', 'p(99)<200'],
    endpoint_divisions: ['p(95)<300', 'p(99)<500'],
    endpoint_articles_list: ['p(95)<500', 'p(99)<1000'],
    endpoint_article_get: ['p(95)<300', 'p(99)<500'],
    endpoint_article_create: ['p(95)<2000', 'p(99)<3000'],
    endpoint_article_publish: ['p(95)<2000', 'p(99)<3000'],
    endpoint_auth_login: ['p(95)<500', 'p(99)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // Test 1: Health check
  const healthStart = Date.now();
  const healthResponse = http.get(`${BASE_URL}/health`);
  endpointDurations.health.add(Date.now() - healthStart);
  check(healthResponse, { 'health OK': (r) => r.status === 200 });
  errorRate.add(healthResponse.status !== 200);
  
  sleep(0.5);
  
  // Test 2: Get divisions
  const divisionsStart = Date.now();
  const divisionsResponse = http.get(`${BASE_URL}/divisions`);
  endpointDurations.divisions.add(Date.now() - divisionsStart);
  check(divisionsResponse, { 'divisions OK': (r) => r.status === 200 });
  errorRate.add(divisionsResponse.status !== 200);
  
  sleep(0.5);
  
  // Test 3: List articles
  const listStart = Date.now();
  const listResponse = http.get(`${BASE_URL}/articles`);
  endpointDurations.articles_list.add(Date.now() - listStart);
  check(listResponse, { 'list OK': (r) => r.status === 200 });
  errorRate.add(listResponse.status !== 200);
  
  sleep(0.5);
  
  // Test 4: Auth login
  const loginStart = Date.now();
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `user${__VU}@besbpo.co.za`,
    password: 'Password123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  endpointDurations.auth_login.add(Date.now() - loginStart);
  const loginSuccess = check(loginResponse, { 'login OK': (r) => r.status === 200 });
  errorRate.add(!loginSuccess);
  
  if (loginSuccess) {
    const token = JSON.parse(loginResponse.body).accessToken;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    
    sleep(0.5);
    
    // Test 5: Create article
    const createStart = Date.now();
    const createResponse = http.post(`${BASE_URL}/articles`, JSON.stringify({
      slug: `test-${Date.now()}-${__VU}-${__ITER}`,
      title: `Load Test ${Date.now()}`,
      bodyMdx: '# Test',
      divisionTags: ['built-environment'],
    }), { headers });
    endpointDurations.article_create.add(Date.now() - createStart);
    const createSuccess = check(createResponse, { 'create OK': (r) => r.status === 201 });
    errorRate.add(!createSuccess);
    
    if (createSuccess) {
      const articleId = JSON.parse(createResponse.body).id;
      
      sleep(0.5);
      
      // Test 6: Get article
      const getStart = Date.now();
      const getResponse = http.get(`${BASE_URL}/articles/${articleId}`, { headers });
      endpointDurations.article_get.add(Date.now() - getStart);
      check(getResponse, { 'get OK': (r) => r.status === 200 });
      errorRate.add(getResponse.status !== 200);
      
      sleep(0.5);
      
      // Test 7: Publish article
      const publishStart = Date.now();
      const publishResponse = http.post(`${BASE_URL}/articles/${articleId}/publish`, '{}', { headers });
      endpointDurations.article_publish.add(Date.now() - publishStart);
      check(publishResponse, { 'publish OK': (r) => r.status === 200 });
      errorRate.add(publishResponse.status !== 200);
    }
  }
  
  sleep(1);
}
