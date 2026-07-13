// K6 Load Test Configuration
// Reference: Master Plan Section 7 - Load Testing
// 
// Usage:
//   k6 run load-tests/api-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const articleCreationTime = new Trend('article_creation_time');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - low load to verify functionality
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    
    // Load test - expected normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
    },
    
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    
    // Spike test - sudden increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 0 },
        { duration: '1m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.1'],
    article_creation_time: ['p(95)<2000'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USERS = 10;
const ARTICLES_PER_USER = 5;

// Generate test users
const testUsers = Array.from({ length: USERS }, (_, i) => ({
  email: `loadtest${i}@besbpo.co.za`,
  password: 'LoadTest123!',
  displayName: `Load Test User ${i}`,
}));

// Get auth token
function getAuthToken(email, password) {
  const response = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email,
    password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => JSON.parse(r.body).accessToken !== undefined,
  });
  
  if (response.status !== 200) {
    return null;
  }
  
  return JSON.parse(response.body).accessToken;
}

// Default function (runs for each VU)
export default function() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  // Get auth token
  const token = getAuthToken(user.email, user.password);
  if (!token) {
    errorRate.add(1);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test 1: Get divisions (read)
  const divisionsResponse = http.get(`${BASE_URL}/divisions`, { headers });
  check(divisionsResponse, {
    'divisions loaded': (r) => r.status === 200,
  });
  errorRate.add(divisionsResponse.status !== 200);
  
  sleep(1);
  
  // Test 2: Create article (write)
  const start = Date.now();
  const articleData = {
    slug: `load-test-${Date.now()}-${__VU}-${__ITER}`,
    title: `Load Test Article ${Date.now()}`,
    bodyMdx: '# Test Content\n\nThis is a load test article.',
    divisionTags: ['built-environment'],
  };
  
  const createResponse = http.post(`${BASE_URL}/articles`, JSON.stringify(articleData), {
    headers,
  });
  
  articleCreationTime.add(Date.now() - start);
  
  const createSuccess = check(createResponse, {
    'article created': (r) => r.status === 201,
  });
  errorRate.add(!createSuccess);
  
  if (createResponse.status === 201) {
    const articleId = JSON.parse(createResponse.body).id;
    
    sleep(1);
    
    // Test 3: Get article (read)
    const getResponse = http.get(`${BASE_URL}/articles/${articleId}`, { headers });
    check(getResponse, {
      'article retrieved': (r) => r.status === 200,
    });
    errorRate.add(getResponse.status !== 200);
    
    sleep(1);
    
    // Test 4: Publish article (write)
    const publishResponse = http.post(`${BASE_URL}/articles/${articleId}/publish`, '{}', { headers });
    check(publishResponse, {
      'article published': (r) => r.status === 200 || r.status === 400,
    });
    errorRate.add(publishResponse.status !== 200 && publishResponse.status !== 400);
  }
  
  sleep(2);
}

// Setup function (runs once before tests)
export function setup() {
  console.log('Setting up load test data...');
  
  const createdUsers = [];
  
  for (const user of testUsers) {
    try {
      const response = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.status === 201) {
        createdUsers.push(user);
      }
    } catch (e) {
      console.log(`Failed to create user ${user.email}: ${e.message}`);
    }
  }
  
  console.log(`Created ${createdUsers.length} test users`);
  
  return { users: createdUsers };
}

// Teardown function (runs once after tests)
export function teardown(data) {
  console.log('Tearing down load test data...');
  // Cleanup would happen here
  console.log(`Load test completed`);
}
