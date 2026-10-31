"""Postgres is the delivery authority; WebSocket events are optional hints."""
import hashlib
import json
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import SQLModel, Session, select

from . import models
from .db import get_session
from .permissions import Permission, require_permission
from .rate_limits import public_table_read_limit

router = APIRouter()


def fingerprint(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def enqueue(session, table, *, kind, message=None, payment_method=None, order_id=None, idempotency_key=None):
    digest = fingerprint(dict(kind=kind, message=message, payment_method=payment_method, order_id=order_id))
    if idempotency_key:
        previous = session.exec(select(models.ServiceRequest).where(models.ServiceRequest.table_id == table.id, models.ServiceRequest.idempotency_key == idempotency_key)).first()
        if previous:
            if previous.request_hash != digest:
                raise HTTPException(409, "Request key already used with different content")
            return previous, False
    else:
        previous = session.exec(select(models.ServiceRequest).where(models.ServiceRequest.table_id == table.id, models.ServiceRequest.kind == kind, models.ServiceRequest.status != "resolved", models.ServiceRequest.request_hash == digest)).first()
        if previous:
            return previous, False
    assigned = table.assigned_waiter_id
    if not assigned and table.floor_id:
        floor = session.get(models.Floor, table.floor_id)
        assigned = floor.default_waiter_id if floor else None
    row = models.ServiceRequest(tenant_id=table.tenant_id, table_id=table.id, order_id=order_id, kind=kind, message=message, payment_method=payment_method, idempotency_key=idempotency_key, request_hash=digest, assigned_waiter_id=assigned)
    session.add(row)
    session.flush()
    return row, True


def payload(row, table_name=None):
    return dict(id=row.id, table_id=row.table_id, table_name=table_name, order_id=row.order_id, kind=row.kind, status=row.status, message=row.message, payment_method=row.payment_method, assigned_waiter_id=row.assigned_waiter_id, handled_by_user_id=row.handled_by_user_id, created_at=row.created_at, updated_at=row.updated_at)


Staff = Annotated[models.User, Depends(require_permission(Permission.ORDER_UPDATE_STATUS))]


@router.get('/menu/{table_token}/service-requests')
@public_table_read_limit()
def public_request_status(table_token: str, request: Request, response: Response, session: Annotated[Session, Depends(get_session)]):
    table = session.exec(select(models.Table).where(models.Table.token == table_token)).first()
    if not table:
        raise HTTPException(404, 'Table not found')
    query = select(models.ServiceRequest).where(models.ServiceRequest.table_id == table.id)
    if table.activated_at:
        query = query.where(models.ServiceRequest.created_at >= table.activated_at)
    rows = session.exec(query.order_by(models.ServiceRequest.id.desc()).limit(20)).all()
    return [dict(id=row.id, kind=row.kind, status=row.status) for row in rows]


def resolve_requests(session, table_id: int, user_id: int | None, order_id: int | None = None):
    query = select(models.ServiceRequest).where(models.ServiceRequest.table_id == table_id, models.ServiceRequest.status != 'resolved')
    if order_id is not None:
        query = query.where(models.ServiceRequest.order_id == order_id, models.ServiceRequest.kind == 'payment_requested')
    for row in session.exec(query).all():
        row.status = 'resolved'
        row.handled_by_user_id = user_id
        row.updated_at = datetime.now(timezone.utc)
        session.add(row)


@router.get('/service-requests')
def list_requests(user: Staff, session: Annotated[Session, Depends(get_session)], include_resolved: bool = False):
    query = select(models.ServiceRequest).where(models.ServiceRequest.tenant_id == user.tenant_id)
    if not include_resolved:
        query = query.where(models.ServiceRequest.status != 'resolved')
    if user.role not in (models.UserRole.owner, models.UserRole.admin):
        query = query.where((models.ServiceRequest.assigned_waiter_id == None) | (models.ServiceRequest.assigned_waiter_id == user.id))
    rows = session.exec(query.order_by(models.ServiceRequest.id.desc()).limit(200)).all()
    return [payload(row, session.get(models.Table, row.table_id).name) for row in rows]


class RequestStatus(SQLModel):
    status: Literal['acknowledged', 'resolved']


@router.patch('/service-requests/{request_id}')
def update_request(request_id: int, body: RequestStatus, user: Staff, session: Annotated[Session, Depends(get_session)]):
    row = session.exec(select(models.ServiceRequest).where(models.ServiceRequest.id == request_id, models.ServiceRequest.tenant_id == user.tenant_id).with_for_update()).first()
    if not row:
        raise HTTPException(404, 'Request not found')
    manager = user.role in (models.UserRole.owner, models.UserRole.admin)
    if not manager and row.assigned_waiter_id not in (None, user.id):
        raise HTTPException(403, 'Request belongs to another waiter')
    if row.status == 'resolved':
        if body.status != 'resolved':
            raise HTTPException(409, 'Resolved request cannot be reopened')
        return payload(row)
    if not manager and row.handled_by_user_id not in (None, user.id):
        raise HTTPException(409, 'Another staff member is handling this request')
    row.status = body.status
    row.handled_by_user_id = user.id
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return payload(row)
