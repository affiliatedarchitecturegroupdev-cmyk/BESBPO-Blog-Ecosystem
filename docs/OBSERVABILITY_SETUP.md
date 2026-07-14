# BESBPO Blog Platform - Observability Setup Guide

## Overview

This guide covers the observability infrastructure for the BESBPO Blog Platform, including structured logging, distributed tracing, metrics collection, and dashboards.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Services                                  │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │ CMS API  │  │ Syndication  │  │ Intelligence│  │  Search │  │
│  │ (NestJS) │  │     Svc      │  │     Svc     │  │ Media   │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬──────┘  └────┬────┘  │
│       │              │                 │              │       │
│       └──────────────┴─────────────────┴──────────────┘       │
│                            │                                   │
│                            ▼                                   │
│              ┌─────────────────────────┐                       │
│              │   OTel Collector       │                       │
│              │   (Traces + Metrics)   │                       │
│              └───────────┬─────────────┘                       │
│                          │                                     │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐             │
│  │  Jaeger    │   │ Prometheus │   │    Loki     │             │
│  │  (Traces) │   │  (Metrics) │   │   (Logs)    │             │
│  └─────┬──────┘   └─────┬──────┘   └──────┬─────┘             │
│        │               │                  │                    │
│        └───────────────┴──────────────────┘                    │
│                        │                                       │
│                        ▼                                       │
│              ┌─────────────────┐                               │
│              │    Grafana      │                               │
│              │  (Dashboards)   │                               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Structured Logging

All services use a unified structured logging format:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "service": "cms-api",
  "version": "1.0.0",
  "environment": "production",
  "requestId": "req_123456_abc123",
  "method": "POST",
  "path": "/api/articles",
  "statusCode": 201,
  "durationMs": 150
}
```

**Implementation**: `src/common/structured-logger.ts`

**Features**:
- JSON format for production, pretty-printed for development
- Automatic redaction of sensitive fields (passwords, tokens)
- Request/response logging middleware
- Child loggers for request-scoped context

### 2. Distributed Tracing (OpenTelemetry)

All services are instrumented with OpenTelemetry for distributed tracing.

**Key Instrumentation**:
- HTTP client/server (automatic)
- PostgreSQL queries
- Redis operations
- Express routes
- Custom spans

**Context Propagation**:
- W3C Trace Context headers
- Request ID tracking
- User session correlation

### 3. Metrics (Prometheus)

Exposed metrics endpoints on port 8080:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests |
| `http_request_duration_ms` | Histogram | Request latency |
| `http_requests_in_flight` | Gauge | Current concurrent requests |
| `db_query_duration_ms` | Histogram | Database query latency |
| `cache_hits_total` | Counter | Redis cache hits |
| `cache_misses_total` | Counter | Redis cache misses |
| `article_events_total` | Counter | Article lifecycle events |

### 4. Dashboards

**Grafana Dashboard**: `infrastructure/observability/besbpo-dashboard.json`

**Panels**:
- API Response Time (p50, p95)
- Request Rate
- Error Rate
- Memory/CPU Usage
- Article Events

## Setup Instructions

### 1. Install Dependencies

```bash
# Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# OpenTelemetry Operator
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
```

### 2. Install Prometheus Stack

```bash
kubectl create namespace observability

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --values infrastructure/observability/prometheus-values.yaml
```

### 3. Install OpenTelemetry Collector

```bash
kubectl apply -f infrastructure/observability/otel-collector-deployment.yaml
```

### 4. Import Grafana Dashboards

```bash
# Port forward to Grafana
kubectl port-forward -n observability svc/grafana 3000:80

# Import dashboard via API
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -d @infrastructure/observability/besbpo-dashboard.json \
  http://localhost:3000/api/dashboards/db
```

### 5. Configure Services

Set environment variables:

```yaml
# Service deployment
env:
  - name: OTEL_ENABLED
    value: "true"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://otel-collector.observability:4317"
  - name: OTEL_SERVICE_NAME
    value: "cms-api"
  - name: LOG_LEVEL
    value: "info"
```

## Accessing Dashboards

| Dashboard | URL | Credentials |
|-----------|-----|-------------|
| Grafana | grafana.besbpo.co.za | SSO via OIDC |
| Jaeger | jaeger.besbpo.co.za | SSO via OIDC |
| Prometheus | prometheus.besbpo.co.za | SSO via OIDC |

## Alerting

### Pre-configured Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | error_rate > 5% for 5m | critical |
| HighLatency | p95 > 2s for 5m | warning |
| ServiceDown | no metrics for 1m | critical |
| DiskPressure | disk > 85% | warning |

### Configuring Alert Receivers

```bash
# Edit alertmanager config
kubectl edit secret alertmanager-main -n observability
```

## Troubleshooting

### Logs Not Appearing

1. Check OTEL collector is running:
   ```bash
   kubectl logs -n observability deployment/otel-collector
   ```

2. Verify service can reach collector:
   ```bash
   kubectl exec -it <pod> -- curl -v http://otel-collector.observability:4318
   ```

### Metrics Not Scraped

1. Check ServiceMonitor exists:
   ```bash
   kubectl get servicemonitor -n observability
   ```

2. Verify Prometheus targets:
   ```bash
   kubectl port-forward -n observability prometheus-prometheus-node-exporter-0 9090
   # Navigate to Status > Targets
   ```

### Dashboard Not Loading

1. Check Grafana pod logs:
   ```bash
   kubectl logs -n observability deployment/grafana
   ```

2. Verify datasource is configured:
   ```bash
   kubectl get datasources -n observability
   ```

## Cost Optimization

| Component | Staging | Production |
|-----------|---------|------------|
| Prometheus | 20GB storage | 50GB storage |
| Retention | 7 days | 15 days |
| Scrape Interval | 30s | 30s |

## Further Reading

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)
