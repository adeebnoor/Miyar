"""Time-based one-time passwords (RFC 6238) for organization accounts.

Secrets are encrypted at rest with a key derived from the server secret. Codes are
accepted once (replay-protected by time step) within a ±1 step window. Administrators
can reset another user's second factor with an audited reason; nobody can read a secret back.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from .models import User, UserMfa
from .security import require, verify_password, issue_token

STEP = 30
DIGITS = 6
ISSUER = 'Miyar'


def _code(secret, step):
    key = base64.b32decode(secret, casefold=True)
    digest = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10 ** DIGITS).zfill(DIGITS)


def current_code(secret, at=None):
    return _code(secret, int((at if at is not None else time.time()) // STEP))


def matching_step(secret, code, last_step, at=None):
    """Return the accepted time step, or None; a step at or before last_step is a replay."""
    code = str(code or '').strip().replace(' ', '')
    if not code.isdigit() or len(code) != DIGITS:
        return None
    now = int((at if at is not None else time.time()) // STEP)
    for step in (now - 1, now, now + 1):
        if step > last_step and hmac.compare_digest(_code(secret, step), code):
            return step
    return None


class Cipher:
    def __init__(self, secret):
        self.fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(('miyar-mfa:' + secret).encode()).digest()))

    def seal(self, value):
        return self.fernet.encrypt(value.encode()).decode()

    def open(self, value):
        try:
            return self.fernet.decrypt(value.encode()).decode()
        except InvalidToken:
            raise HTTPException(500, 'Second-factor secret cannot be read; ask an administrator to reset it')


class PasswordConfirm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    currentPassword: str = Field(min_length=1, max_length=256)


class CodeConfirm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    code: str = Field(min_length=6, max_length=10)


class Disable(PasswordConfirm):
    code: str = Field(min_length=6, max_length=10)


class Reset(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: str = Field(min_length=10, max_length=500)


def check_login(db, user, code, cipher):
    """Called after a correct password. Returns None when no second factor is enrolled."""
    row = db.get(UserMfa, user.id)
    if not row or not row.enabled:
        return None
    if not code:
        raise HTTPException(401, {'message': 'Authenticator code required', 'mfaRequired': True})
    step = matching_step(cipher.open(row.secret), code, row.last_step)
    if step is None:
        return False
    row.last_step = step
    return True


def install(app, session, current, audit, secret):
    cipher = Cipher(secret)
    app.state.mfa_cipher = cipher

    def locked(db, user):
        return db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))

    @app.get('/api/v1/auth/mfa')
    def mfa_state(user=Depends(current), db=Depends(session)):
        row = db.get(UserMfa, user.id)
        return {'enabled': bool(row and row.enabled), 'pendingSetup': bool(row and not row.enabled), 'method': 'totp'}

    @app.post('/api/v1/auth/mfa/setup')
    def setup(body: PasswordConfirm, user=Depends(current), db=Depends(session)):
        user = locked(db, user)
        if not verify_password(body.currentPassword, user.password_hash):
            raise HTTPException(422, 'Current password is incorrect')
        row = db.get(UserMfa, user.id)
        if row and row.enabled:
            raise HTTPException(409, 'Two-step sign-in is already enabled')
        value = base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
        if row:
            row.secret, row.last_step = cipher.seal(value), 0
        else:
            db.add(UserMfa(user_id=user.id, secret=cipher.seal(value), enabled=False, last_step=0))
        audit(db, user, 'auth.mfa-setup-started', {'method': 'totp'})
        db.commit()
        label = quote(ISSUER + ':' + user.email)
        return {'secret': value, 'otpauthUri': 'otpauth://totp/' + label + '?secret=' + value + '&issuer=' + ISSUER + '&algorithm=SHA1&digits=6&period=30',
                'confirmRequired': True}

    @app.post('/api/v1/auth/mfa/confirm')
    def confirm(body: CodeConfirm, user=Depends(current), db=Depends(session)):
        user = locked(db, user)
        row = db.get(UserMfa, user.id)
        if not row or row.enabled:
            raise HTTPException(409, 'Start two-step setup first')
        step = matching_step(cipher.open(row.secret), body.code, row.last_step)
        if step is None:
            raise HTTPException(422, 'The authenticator code is not valid; check the device clock and try again')
        row.enabled, row.last_step = True, step
        user.session_version += 1
        audit(db, user, 'auth.mfa-enabled', {'method': 'totp', 'otherSessionsRevoked': True})
        db.commit()
        return {'enabled': True, 'accessToken': issue_token(user, secret), 'tokenType': 'Bearer', 'expiresIn': 1800}

    @app.post('/api/v1/auth/mfa/disable')
    def disable(body: Disable, user=Depends(current), db=Depends(session)):
        user = locked(db, user)
        row = db.get(UserMfa, user.id)
        if not row or not row.enabled:
            raise HTTPException(409, 'Two-step sign-in is not enabled')
        if not verify_password(body.currentPassword, user.password_hash) or matching_step(cipher.open(row.secret), body.code, row.last_step) is None:
            raise HTTPException(422, 'Password or authenticator code is incorrect')
        db.delete(row)
        user.session_version += 1
        audit(db, user, 'auth.mfa-disabled', {'method': 'totp'})
        db.commit()
        return {'enabled': False, 'accessToken': issue_token(user, secret), 'tokenType': 'Bearer', 'expiresIn': 1800}

    @app.post('/api/v1/users/{id}/mfa/reset')
    def reset(id: str, body: Reset, user=Depends(current), db=Depends(session)):
        require(user, 'admin')
        target = db.scalar(select(User).where(User.id == id, User.org_id == user.org_id))
        if not target or target.id == user.id:
            raise HTTPException(422, 'Reset applies to another account in your organization')
        row = db.get(UserMfa, target.id)
        if row:
            db.delete(row)
        target.session_version += 1
        audit(db, user, 'auth.mfa-reset', {'userId': target.id, 'reason': body.reason, 'sessionsRevoked': True})
        db.commit()
        return {'reset': True}
