from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Block(BaseModel):
    type: str

    model_config = ConfigDict(extra="allow")


class Section(BaseModel):
    id: str
    placeholder: str
    flag_name: Optional[str] = None
    enabled: bool = True
    blocks: List[Block] = Field(default_factory=list)
    order: Optional[int] = None
    subdoc_title: Optional[str] = None
    subdoc_title_level: int = 2


class Attachment(BaseModel):
    id: str
    placeholder: str
    flag_name: Optional[str] = None
    enabled: bool = True
    title: Optional[str] = None
    title_level: int = 2
    blocks: List[Block] = Field(default_factory=list)
    order: Optional[int] = None


class AttachmentsBundle(BaseModel):
    enabled: bool = True
    placeholder: str = "APPENDICES_SUBDOC"
    flag_name: str = "ENABLE_APPENDICES"
    page_break_between_attachments: bool = True
    include_attachment_title: bool = True


class Payload(BaseModel):
    context: Dict[str, Any] = Field(default_factory=dict)
    sections: List[Section] = Field(default_factory=list)
    attachments: List[Attachment] = Field(default_factory=list)
    attachments_bundle: Optional[AttachmentsBundle] = None
    style_map: Dict[str, str] = Field(default_factory=dict)
