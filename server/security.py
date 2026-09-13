import os,secrets,time,jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import HTTPException,Request
from fastapi.security import HTTPBearer
from sqlalchemy import select
from .models import User,Position

hasher=PasswordHasher(time_cost=3,memory_cost=65536,parallelism=2)
bearer=HTTPBearer(auto_error=False)

def password_hash(value):
    if len(value)<12 or len(value)>256:raise ValueError('Use a password of 12–256 characters')
    return hasher.hash(value)
def verify_password(value,encoded):
    try:return hasher.verify(encoded,value)
    except (VerificationError,ValueError):return False

def issue_token(user,secret):
    ts=int(time.time());return jwt.encode({'sub':user.id,'ver':user.session_version,'iat':ts,'exp':ts+1800,'iss':'miyar-enterprise','aud':'miyar-api','jti':secrets.token_hex(16)},secret,algorithm='HS256')
def decode_token(token,secret):
    try:return jwt.decode(token,secret,algorithms=['HS256'],issuer='miyar-enterprise',audience='miyar-api',options={'require':['exp','iat','sub','ver','jti']})
    except jwt.InvalidTokenError:raise HTTPException(401,'Session expired or invalid')

def actor(token,db,secret):
    payload=decode_token(token,secret);user=db.get(User,payload['sub'])
    if not user or not user.active or user.session_version!=payload['ver']:raise HTTPException(401,'Session revoked')
    return user

def require(user,*roles):
    if user.role not in roles:raise HTTPException(403,'This role cannot perform this action')

def position_for(db,user,id,lock=False):
    query=select(Position).where(Position.id==id,Position.org_id==user.org_id)
    if user.role=='line_manager':query=query.where(Position.department_id==user.department_id)
    if lock:query=query.with_for_update()
    value=db.scalar(query)
    if not value:raise HTTPException(404,'Position not found')
    return value

def scoped_positions(user):
    query=select(Position).where(Position.org_id==user.org_id)
    if user.role=='line_manager':query=query.where(Position.department_id==user.department_id)
    return query
