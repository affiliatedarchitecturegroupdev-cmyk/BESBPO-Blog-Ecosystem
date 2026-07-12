from fastapi import APIRouter

from app.models import TaggingProposal, TaggingRequest
from app.services.tagging_service import suggest_tags

router = APIRouter(prefix="/v1/tag", tags=["tagging"])


@router.post("/propose", response_model=TaggingProposal)
async def propose_tags(request: TaggingRequest) -> TaggingProposal:
    """Propose division_tags and free-form tags for an article.

    The response is always `source=ai_proposed` — implements the human
    approval gate from Doc-03 Section 6: this endpoint never writes directly
    to the CMS core; a Division Editor must accept/edit the proposal in the
    Editorial Dashboard before it can affect a publish-eligible article.
    """
    return await suggest_tags(
        article_id=request.article_id,
        title=request.title,
        body_mdx=request.body_mdx,
        known_divisions=request.known_divisions,
    )
