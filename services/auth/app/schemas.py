from pydantic import BaseModel, EmailStr, field_validator, Field

from app.config import settings


class OtpRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def must_be_college_email(cls, value: str) -> str:
        value = value.lower()
        if not value.endswith("@" + settings.allowed_email_domain):
            raise ValueError(f"Use your @{settings.allowed_email_domain} email")
        return value


class MessageResponse(BaseModel):
    message: str


from typing import Annotated

from pydantic import StringConstraints


class OtpVerify(OtpRequest):
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    display_name: str
    is_new_user: bool


class RefreshRequest(BaseModel):
    refresh_token: Annotated[str, StringConstraints(min_length=20, max_length=200)]


class RefreshResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class BanRequest(BaseModel):
    days: Annotated[int, Field(ge=1, le=365)]


from app.models import UserRole


class RoleRequest(BaseModel):
    role: UserRole
