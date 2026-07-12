from fastapi import APIRouter

from app.models import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import generate_embedding

router = APIRouter(prefix="/v1/embeddings", tags=["embeddings"])


@router.post("/generate", response_model=EmbeddingResponse)
async def generate(request: EmbeddingRequest) -> EmbeddingResponse:
    """Generate an embedding vector for semantic search/recommendations
    (Doc-03 Sections 6-7), via Voyage AI when VOYAGE_API_KEY is configured
    — see embedding_service.py for the deterministic placeholder fallback
    used otherwise, which is NOT semantically meaningful.
    """
    return await generate_embedding(article_id=request.article_id, text=request.text)
