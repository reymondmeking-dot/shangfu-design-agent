from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Ident = Annotated[str, Field(pattern=r'^[A-Za-z0-9_-]{1,100}$')]
Scene = Literal['private', 'group']
Text = Annotated[str, StringConstraints(strip_whitespace=False,min_length=1,max_length=4200)]


class Request(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    projectId: Ident | None = None
    expectedRevision: int | None = Field(None, ge=0)
    requestId: Ident | None = None


class NewProject(Request):
    title: str = Field('未命名定制项目', min_length=1, max_length=120)
    scene: Scene = 'private'
    reuseNoteId: Ident | None = None


class Extract(NewProject):
    text: Text
    intakeId: Ident | None = None

    @field_validator('text')
    @classmethod
    def nonblank(cls,value):
        if not value.strip():raise ValueError('客户原话不能为空白')
        return value


class Parameter(BaseModel):
    model_config = ConfigDict(extra='allow')
    key: str = Field(min_length=1,max_length=40)
    label: str = Field('',max_length=80)
    source: Literal['customer','pending','agent','advisor'] = 'pending'
    level: Literal['required','preferred','unspecified'] = 'unspecified'
    value: str = Field(max_length=350)
    evidence: str = Field('',max_length=900)


class Parameters(BaseModel):
    model_config = ConfigDict(extra='allow')
    fields: list[Parameter] = Field(min_length=1,max_length=30)
    sourceText: str = Field('',max_length=4200)

    @field_validator('fields')
    @classmethod
    def unique_fields(cls, values):
        if len({v.key for v in values}) != len(values):
            raise ValueError('需求字段重复')
        return values


class Match(Request):
    requirements: Parameters | list[Parameter]
    scene: Scene
    intakeId: Ident | None = None
    requirementId: Ident | None = None
    matchId: Ident | None = None

    def parameters(self):
        if isinstance(self.requirements,list):
            return Parameters(fields=self.requirements).model_dump()
        return self.requirements.model_dump()


class Solution(Match):
    solutionId: Ident | None = None
    selected: dict[str, str | None] | None = None
    title: str = Field('未命名定制项目',min_length=1,max_length=120)
    version: int = Field(1,ge=1,le=40)
    placketWidth: float | None = Field(None,ge=20,le=50)
    reason: str = Field('',max_length=400)
    actor: Literal['版师','定制顾问']='定制顾问'


class Revision(Request):
    solutionId: Ident
    version: int = Field(ge=1,le=40)


class Review(Revision):
    drawingId: Ident
    decision: Literal['approved','revise-requirements','revise-pattern']
    comment: str = Field(min_length=1,max_length=400)
    reviewId: Ident | None = None


class Archive(Revision):
    drawingId: Ident
    reviewId: Ident


class Reuse(Revision):
    checklist: list[Annotated[str,Field(min_length=1,max_length=240)]] = Field(min_length=1,max_length=12)
    noteId: Ident | None = None


class RenderJob(BaseModel):
    model: dict[str,Any]
    projectId: Ident | None = None
    solutionId: Ident | None = None
    version: int | None = None


class ModelObservation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    key: Literal['style','silhouette','fabric','craft','color','scene','activity']
    quote: str = Field(min_length=1,max_length=160)
    value: str = Field(min_length=1,max_length=100)


class ModelInterpretation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    observations: list[ModelObservation] = Field(max_length=7)
