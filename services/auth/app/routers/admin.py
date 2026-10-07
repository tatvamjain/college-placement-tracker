import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session, require_role
from app.models import UserRole
from app.schemas import BanRequest, MessageResponse, RoleRequest
from app.services import admin

router = APIRouter(prefix="/admin", tags=["admin"])

STAFF = require_role(UserRole.moderator, UserRole.admin)
ADMIN = require_role(UserRole.admin)


def _to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, admin.UserNotFound):
        return HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return HTTPException(status.HTTP_400_BAD_REQUEST, "You can't do that to yourself")


@router.post("/users/{user_id}/ban", response_model=MessageResponse)
async def ban(
    user_id: uuid.UUID,
    body: BanRequest,
    claims: dict = Depends(STAFF),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    try:
        until = await admin.ban_user(
            session, uuid.UUID(claims["sub"]), user_id, body.days
        )
    except (admin.UserNotFound, admin.CannotTargetSelf) as exc:
        raise _to_http(exc)
    return MessageResponse(message=f"Banned until {until.isoformat()}")


@router.patch("/users/{user_id}/role", response_model=MessageResponse)
async def change_role(
    user_id: uuid.UUID,
    body: RoleRequest,
    claims: dict = Depends(ADMIN),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    try:
        await admin.set_role(session, uuid.UUID(claims["sub"]), user_id, body.role)
    except (admin.UserNotFound, admin.CannotTargetSelf) as exc:
        raise _to_http(exc)
    return MessageResponse(message=f"Role set to {body.role.value}")


@router.delete("/users/{user_id}/ban", response_model=MessageResponse)
async def unban(
    user_id: uuid.UUID,
    claims: dict = Depends(STAFF),
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    try:
        await admin.unban_user(session, uuid.UUID(claims["sub"]), user_id)
    except (admin.UserNotFound, admin.CannotTargetSelf) as exc:
        raise _to_http(exc)
    return MessageResponse(message="User unbanned")
