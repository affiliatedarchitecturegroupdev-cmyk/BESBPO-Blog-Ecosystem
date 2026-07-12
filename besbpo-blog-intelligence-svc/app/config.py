"""Runtime configuration for the Content Intelligence Service.

Implements the environment variable checklist referenced in
BESBPO-BLOG-ARCH-04 (Infrastructure & DevOps Plan), Appendix.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "besbpo-blog-intelligence-svc"
    port: int = 8000

    # Anthropic (Claude) — used for tagging, SEO, and summarisation
    # proposals (app/services/llm_client.py). Empty api_key means "no LLM
    # configured" — services fall back to their deterministic heuristics
    # rather than failing, matching besbpo-blog-web's fixture-fallback
    # philosophy for local dev / CI without secrets configured.
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # Voyage AI — Anthropic's recommended embeddings partner (Claude has
    # no first-party embeddings API; see ADR 0004 in besbpo-blog-architecture).
    # embedding_dimensions MUST match the pgvector column width in
    # besbpo-blog-architecture/db/schema.sql (1024 by default, matching
    # Voyage's default output_dimension for the voyage-3.5 family) — if
    # you change one, change the other and re-embed everything.
    voyage_api_key: str = ""
    voyage_model: str = "voyage-3.5"
    embedding_dimensions: int = 1024

    # NOTE: not currently read by any code in this service — cms-api calls
    # INTO this service (tagging/SEO/summarisation/embeddings endpoints),
    # never the other way around, so there's never been a real outbound
    # call that would need this. Found unused while tracing the Docker
    # Compose dependency graph for a cycle (this field's presence had
    # produced an incorrect depends_on: [cms-api] there, which would have
    # formed a real cycle once cms-api gained its own, actually-justified
    # dependency on this service — see docker-compose.yml's comment on
    # the intelligence-svc block). Left in place in case a real use
    # emerges, not removed just because it's currently dead.
    cms_core_api_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
