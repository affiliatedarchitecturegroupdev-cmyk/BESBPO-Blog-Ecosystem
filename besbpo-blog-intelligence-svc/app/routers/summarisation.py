from fastapi import APIRouter

from app.models import SummarisationProposal, SummarisationRequest
from app.services.summarisation_service import summarise

router = APIRouter(prefix="/v1/summarise", tags=["summarisation"])


@router.post("/propose", response_model=SummarisationProposal)
async def propose_summary(request: SummarisationRequest) -> SummarisationProposal:
    """Propose a syndication excerpt for an article. Always `source=ai_proposed`."""
    return await summarise(
        article_id=request.article_id,
        body_mdx=request.body_mdx,
        max_characters=request.max_characters,
    )
