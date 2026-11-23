from datetime import datetime, timedelta, timezone
from hashlib import sha256, scrypt
from hmac import compare_digest
from secrets import token_hex, token_urlsafe
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, select
from sqlalchemy.orm import Session

from db.db import Base, get_db
from db.models import Exhibit, GardenStaff, Location

router = APIRouter(prefix="/auth")
Database = Annotated[Session, Depends(get_db)]
Bearer = Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))]


class AccessToken(Base):
    __tablename__ = "access_tokens"

    digest = Column(String(64), primary_key=True)
    staff_id = Column(Integer, ForeignKey("garden_staff.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)


class Credentials(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or token_hex(16)
    digest = scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return f"scrypt:{salt}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("scrypt:"):
        _, salt, _ = stored.split(":")
        return compare_digest(stored, hash_password(password, salt))
    return compare_digest(stored, sha256(password.encode()).hexdigest())


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def issue_token(db: Session, staff: GardenStaff, lifetime: timedelta) -> str:
    value = token_urlsafe(32)
    db.add(AccessToken(
        digest=sha256(value.encode()).hexdigest(),
        staff_id=staff.id,
        expires_at=now() + lifetime,
    ))
    db.commit()
    return value


def current_token(db: Database, bearer: Bearer) -> AccessToken:
    token = db.get(AccessToken, sha256(bearer.credentials.encode()).hexdigest()) if bearer else None
    if token is None or token.expires_at <= now():
        raise HTTPException(401, "Войдите в систему", headers={"WWW-Authenticate": "Bearer"})
    return token


def current_staff(db: Database, token: Annotated[AccessToken, Depends(current_token)]) -> GardenStaff:
    staff = db.get(GardenStaff, token.staff_id)
    if staff is None or not staff.is_active:
        raise HTTPException(403, "Учётная запись недоступна")
    return staff


def curator(staff: Annotated[GardenStaff, Depends(current_staff)]) -> GardenStaff:
    if staff.role.name != "agronomist":
        raise HTTPException(403, "Действие доступно куратору")
    return staff


def administrator(staff: Annotated[GardenStaff, Depends(current_staff)]) -> GardenStaff:
    if staff.role.name != "superadmin":
        raise HTTPException(403, "Действие доступно администратору БД")
    return staff


def curator_locations(db: Session, staff: GardenStaff) -> list[Location]:
    return list(db.scalars(
        select(Location).join(Exhibit).where(Exhibit.curator_id == staff.id)
        .distinct().order_by(Location.id)
    ))


@router.post("/login")
def login(credentials: Credentials, db: Database):
    staff = db.scalar(select(GardenStaff).filter_by(username=credentials.login.strip().lower()))
    if staff is None or not staff.is_active or not verify_password(credentials.password, staff.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")

    if not staff.password_hash.startswith("scrypt:"):
        staff.password_hash = hash_password(credentials.password)

    profiles = {
        "agronomist": ("curator", "Куратор (Агроном)"),
        "superadmin": ("dbadmin", "Администратор БД"),
    }
    role, title = profiles.get(staff.role.name, ("staff", staff.full_name))
    sectors = [location.name for location in curator_locations(db, staff)] if role == "curator" else []
    return {
        "token": issue_token(db, staff, timedelta(hours=8)),
        "user": {"role": role, "title": title, "sector": next(iter(sectors), ""), "sectors": sectors},
    }


@router.post("/logout", status_code=204)
def logout(db: Database, token: Annotated[AccessToken, Depends(current_token)]):
    db.delete(token)
    db.commit()
    return Response(status_code=204)
