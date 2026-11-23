import sqlite3
from datetime import timedelta
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import inspect

from db.db import engine
from db.models import GardenStaff
from security import Database, administrator, issue_token, now

router = APIRouter(prefix="/admin")
Administrator = Annotated[GardenStaff, Depends(administrator)]


@router.get("/tables")
def list_tables(staff: Administrator):
    return inspect(engine).get_table_names()


@router.post("/backup", status_code=201)
def create_backup(staff: Administrator):
    directory = Path(engine.url.database).resolve().parent / "backups"
    directory.mkdir(exist_ok=True, mode=0o700)
    file = directory / f"backup-{now():%Y%m%d-%H%M%S}-{uuid4().hex[:8]}.db"
    file.touch(mode=0o600, exist_ok=False)
    source = engine.raw_connection()
    try:
        target = sqlite3.connect(file)
        try:
            source.driver_connection.backup(target)
        finally:
            target.close()
    except Exception:
        file.unlink(missing_ok=True)
        raise
    finally:
        source.close()
    return {"file": str(file.relative_to(directory.parent))}


@router.post("/tokens", status_code=201)
def create_token(staff: Administrator, db: Database):
    return {"token": issue_token(db, staff, timedelta(days=30))}
