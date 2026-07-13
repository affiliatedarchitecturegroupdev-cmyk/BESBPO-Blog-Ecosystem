# Load Testing Guide

## Overview

This directory contains load testing configurations for the BESBPO Blog Platform.

## Prerequisites

```bash
# Install k6
brew install k6      # macOS
# or
sudo apt install k6  # Ubuntu/Debian

# For JavaScript support
npm install -g xk6
```

## Running Load Tests

### API Load Test (Main)

```bash
# Run with default configuration (smoke test)
k6 run load-tests/k6-config.js

# Run specific scenario
k6 run -e SCENARIO=load load-tests/k6-config.js

# Run with environment-specific URL
BASE_URL=https://api.besbpo.co.za k6 run load-tests/k6-config.js
```

### Endpoint-Specific Load Test

```bash
k6 run load-tests/endpoints-scenario.js
```

## Test Scenarios

### 1. Smoke Test
Low load (1 VU) to verify basic functionality.

```bash
k6 run --env SCENARIO=smoke load-tests/k6-config.js
```

### 2. Load Test
Normal expected load (20 VUs) for 5 minutes.

```bash
k6 run --env SCENARIO=load load-tests/k6-config.js
```

### 3. Stress Test
High load (50 VUs) to find breaking point.

```bash
k6 run --env SCENARIO=stress load-tests/k6-config.js
```

### 4. Spike Test
Sudden increase to 100 VUs.

```bash
k6 run --env SCENARIO=spike load-tests/k6-config.js
```

## Expected Thresholds

| Endpoint | p(95) | p(99) |
|----------|-------|-------|
| Health | < 100ms | < 200ms |
| Divisions List | < 300ms | < 500ms |
| Articles List | < 500ms | < 1000ms |
| Article Get | < 300ms | < 500ms |
| Article Create | < 2000ms | < 3000ms |
| Article Publish | < 2000ms | < 3000ms |
| Auth Login | < 500ms | < 1000ms |

## CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run Load Tests
  run: |
    if [ "${{ github.ref }}" = "refs/heads/main" ]; then
      k6 run load-tests/k6-config.js
    fi
  env:
    BASE_URL: ${{ vars.STAGING_API_URL }}
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
```

## Monitoring

### Cloud Dashboard
Sign up at https://k6.io/cloud for hosted results.

### Prometheus Integration
```bash
k6 run --out prometheus=localhost:9090 load-tests/k6-config.js
```

## Interpreting Results

### Success Criteria
- Error rate < 1%
- p(95) latency under threshold
- No failed checks

### Warning Signs
- Error rate > 5%
- p(99) latency > 2x p(95)
- Memory usage growing

### Failure Signs
- Error rate > 10%
- Timeouts increasing
- Service unavailable responses
