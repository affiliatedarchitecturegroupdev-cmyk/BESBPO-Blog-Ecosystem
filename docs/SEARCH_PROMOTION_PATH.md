# Tantivy to OpenSearch Promotion Path

## Overview

This document outlines the migration path from the current in-memory Tantivy-based search index to OpenSearch for production deployment. The current implementation serves as a solid foundation but has limitations for large-scale deployments.

## Current Architecture

```
┌─────────────────┐    ┌──────────────────────────────────┐
│ besbpo-blog-web │───▶│ besbpo-blog-search-media-svc     │
│   (Next.js)     │    │  ┌────────────────────────────┐  │
└─────────────────┘    │  │  In-Memory Search Index    │  │
                       │  │  (Tantivy-style hybrid)    │  │
                       │  └────────────────────────────┘  │
                       │              ▲                   │
                       │              │                   │
                       │  ┌───────────┴────────────┐     │
                       │  │ PostgreSQL + pgvector  │     │
                       │  │ (Source of truth)       │     │
                       │  └────────────────────────┘     │
                       └──────────────────────────────────┘
```

## Limitations of Current Architecture

1. **Scalability**: In-memory index doesn't scale horizontally
2. **Persistence**: Index lost on service restart
3. **High Availability**: Single point of failure
4. **Advanced Features**: No aggregations, faceting, or suggestions

## Target Architecture (OpenSearch)

```
┌─────────────────┐    ┌──────────────────────────────────┐
│ besbpo-blog-web │───▶│ OpenSearch Cluster               │
│   (Next.js)     │    │  ┌────────────────────────────┐  │
└─────────────────┘    │  │ articles-index            │  │
                       │  │  - Full-text search       │  │
                       │  │  - Vector search (k-NN)   │  │
                       │  │  - Aggregations           │  │
                       │  │  - Suggestions            │  │
                       │  └────────────────────────────┘  │
                       └──────────────────────────────────┘
                                ▲
                                │
┌────────────────────────────────┴─────────────────────────┐
│ besbpo-blog-cms-api                                     │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │ PostgreSQL +        │  │ Event Publisher            │ │
│  │ pgvector           │──│ (on article publish)       │ │
│  └─────────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Migration Phases

### Phase 1: Dual-Write (Zero-Downtime)

**Goal**: Write to both Tantivy and OpenSearch simultaneously

1. Deploy OpenSearch cluster (2+ data nodes)
2. Create index with mappings matching current schema
3. Update CMS API to publish events to OpenSearch
4. Keep Tantivy as primary, OpenSearch as shadow

```typescript
// cms-api/src/services/search.service.ts

export class SearchService {
  async indexArticle(article: Article): Promise<void> {
    // Write to current Tantivy index
    await this.tantivyIndex.index(article);
    
    // Write to OpenSearch (new)
    await this.opensearchClient.index({
      index: 'articles',
      id: article.id,
      body: this.transformToOpenSearchDocument(article),
    });
  }
}
```

### Phase 2: Read Diversion (Gradual Traffic Shift)

**Goal**: Route increasing percentage of reads to OpenSearch

1. Add feature flag for search backend selection
2. Start with 10% traffic to OpenSearch
3. Monitor metrics and error rates
4. Gradually increase to 50%, 75%, 100%

```typescript
// search-media-svc/src/search_adapter.ts

export class SearchAdapter {
  constructor(
    private tantivy: TantivyIndex,
    private opensearch: OpenSearchClient,
    private featureFlag: FeatureFlagService,
  ) {}

  async search(query: string, params: SearchParams): Promise<SearchResults> {
    const useOpenSearch = await this.featureFlag.isEnabled('opensearch_search');
    
    if (useOpenSearch) {
      return this.opensearch.search(query, params);
    }
    return this.tantivy.search(query, params);
  }
}
```

### Phase 3: OpenSearch as Primary (Tantivy Shadow)

**Goal**: Make OpenSearch the primary, Tantivy as shadow

1. Switch default to OpenSearch
2. Continue writing to Tantivy for rollback capability
3. Monitor for any issues
4. Keep for 1-2 weeks before removal

### Phase 4: Tantivy Removal

**Goal**: Remove Tantivy dependency

1. Remove Tantivy code from search-media-svc
2. Update documentation
3. Clean up old code paths
4. Archive Tantivy implementation

## OpenSearch Index Mapping

```json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "content_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": {
        "type": "text",
        "analyzer": "content_analyzer",
        "fields": {
          "keyword": { "type": "keyword" },
          "suggest": { "type": "search_as_you_type" }
        }
      },
      "body": {
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "excerpt": {
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "slug": { "type": "keyword" },
      "author": {
        "properties": {
          "id": { "type": "keyword" },
          "name": { "type": "text" }
        }
      },
      "division_tags": { "type": "keyword" },
      "published_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil",
          "engine": "nmslib"
        }
      }
    }
  }
}
```

## Event Schema for Indexing

```typescript
interface ArticleIndexedEvent {
  eventType: 'article.indexed';
  timestamp: string;
  payload: {
    id: string;
    title: string;
    body: string;
    excerpt: string;
    slug: string;
    author: {
      id: string;
      name: string;
    };
    divisionTags: string[];
    publishedAt: string;
    embedding?: number[];
  };
}

interface ArticleDeletedEvent {
  eventType: 'article.deleted';
  timestamp: string;
  payload: {
    id: string;
  };
}
```

## Monitoring and Validation

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| search_latency_p50 | 50th percentile latency | < 50ms |
| search_latency_p99 | 99th percentile latency | < 200ms |
| search_error_rate | Percentage of failed searches | < 0.1% |
| index_lag | Time between publish and searchable | < 5s |
| result_relevance | Click-through rate on results | > 20% |

### Comparison Validation

Run parallel searches during migration to ensure results match:

```typescript
async function validateMigration() {
  const query = 'smart cities infrastructure';
  
  const [tantivyResults, openSearchResults] = await Promise.all([
    tantivySearch.search(query),
    openSearchSearch.search(query),
  ]);
  
  const tantivyIds = new Set(tantivyResults.map(r => r.id));
  const openSearchIds = new Set(openSearchResults.map(r => r.id));
  
  const overlap = [...tantivyIds].filter(id => openSearchIds.has(id));
  const matchRate = overlap.length / tantivyResults.length;
  
  console.log(`Match rate: ${(matchRate * 100).toFixed(1)}%`);
  
  if (matchRate < 0.95) {
    throw new Error('Search results diverged significantly!');
  }
}
```

## Rollback Plan

1. **Immediate (< 1 hour)**: Toggle feature flag to Tantivy
2. **Short-term (< 24 hours)**: Redeploy with Tantivy as primary
3. **Data recovery**: Re-sync from PostgreSQL if needed

```typescript
// Emergency rollback
const rollback = async () => {
  await featureFlag.setEnabled('opensearch_search', false);
  await publishAlert('Search migration rolled back');
  await createIncident('Search Migration Failed');
};
```

## Estimated Timeline

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Dual-Write | 1-2 weeks | Low |
| Phase 2: Read Diversion | 2-4 weeks | Medium |
| Phase 3: OpenSearch Primary | 1-2 weeks | Medium |
| Phase 4: Tantivy Removal | 1 week | Low |

## Dependencies

- OpenSearch 2.x cluster (3 nodes minimum for HA)
- AWS OpenSearch Service or self-hosted
- Index backup strategy (snapshot to S3)
- Monitoring dashboards (OpenSearch Dashboard)

## Next Steps

1. Provision OpenSearch cluster in staging
2. Create initial index mappings
3. Implement dual-write in CMS API
4. Set up monitoring and alerts
5. Begin Phase 1 migration
