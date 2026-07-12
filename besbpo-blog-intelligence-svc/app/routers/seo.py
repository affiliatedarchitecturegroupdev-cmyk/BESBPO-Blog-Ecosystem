from fastapi import APIRouter

from app.models import SeoProposal, SeoRequest
from app.services.seo_service import propose_seo_meta

router = APIRouter(prefix="/v1/seo", tags=["seo"])


@router.post("/propose", response_model=SeoProposal)
async def propose_seo(request: SeoRequest) -> SeoProposal:
    """Propose SEO metadata for an article. Always `source=ai_proposed`."""
    return await propose_seo_meta(
        article_id=request.article_id,
        title=request.title,
        excerpt=request.excerpt,
        body_mdx=request.body_mdx,
    )
