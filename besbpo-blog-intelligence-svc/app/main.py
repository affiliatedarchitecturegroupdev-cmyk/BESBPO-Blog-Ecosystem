"""Content Intelligence Service — auto-tagging, SEO proposal, summarisation,
and embeddings for the Besbpo Group blog (Doc-01 Section 5, Doc-03 Section 6).

Every endpoint in this service produces a *proposal*, never a committed
change — the human-approval gate lives in besbpo-blog-cms-api
(ArticlesService.transition), not here. This service should never be given
write access to the CMS core's database directly.
"""
from fastapi import FastAPI

from app.config import get_settings
from app.routers import embeddings, seo, summarisation, tagging

settings = get_settings()

app = FastAPI(
    title="Besbpo Group Content Intelligence Service",
    description="AI-assisted authoring proposals (tagging, SEO, summarisation, embeddings).",
    version="0.1.0",
)

app.include_router(tagging.router)
app.include_router(seo.router)
app.include_router(summarisation.router)
app.include_router(embeddings.router)


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok", "service": settings.service_name}
