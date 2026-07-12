"""Pydantic request/response models.

These mirror the `ai_proposed` / `human_approved` field-source pattern
established in the CMS core (besbpo-blog-cms-api) so a proposal from this
service can be written directly onto an Article record without translation.
Implements BESBPO-BLOG-ARCH-03 Section 6.
"""
from enum import Enum

from pydantic import BaseModel, Field


class FieldSource(str, Enum):
    HUMAN = "human"
    AI_PROPOSED = "ai_proposed"
    HUMAN_APPROVED = "human_approved"


class TaggingRequest(BaseModel):
    article_id: str
    title: str
    body_mdx: str
    known_divisions: list[str] = Field(
        default_factory=list,
        description="The full division taxonomy (Doc-03 Section 5) to constrain suggestions to valid keys.",
    )


class TaggingProposal(BaseModel):
    article_id: str
    division_tags: list[str]
    free_form_tags: list[str]
    source: FieldSource = FieldSource.AI_PROPOSED
    confidence: float = Field(ge=0.0, le=1.0)


class SeoRequest(BaseModel):
    article_id: str
    title: str
    excerpt: str | None = None
    body_mdx: str


class SeoProposal(BaseModel):
    article_id: str
    meta_title: str
    meta_description: str
    og_title: str
    og_description: str
    source: FieldSource = FieldSource.AI_PROPOSED


class SummarisationRequest(BaseModel):
    article_id: str
    body_mdx: str
    max_characters: int = Field(default=240, le=400)


class SummarisationProposal(BaseModel):
    article_id: str
    excerpt: str
    source: FieldSource = FieldSource.AI_PROPOSED


class EmbeddingRequest(BaseModel):
    article_id: str
    text: str


class EmbeddingResponse(BaseModel):
    article_id: str
    embedding: list[float]
    model: str
    dimensions: int
