from pydantic import BaseModel, EmailStr, field_validator

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


class VerifyResponse(BaseModel):
    display_name: str
    is_new_user: bool