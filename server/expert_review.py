"""Time-limited public expert trial, isolated from all organization data.

The operator must explicitly enable this separate capability and set its expiry.
Hard persisted quotas apply before any provider call, including failed calls.
No accounts, tokens, organization records, prompts or outputs are stored here.
"""
import hashlib
import hmac
import os
import time
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from .models import ExpertReviewQuota
from .strategic import Unavailable, capability

DAILY_LIMIT = 60
HOURLY_LIMIT = 12
COOLDOWN = 20


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=15, max_length=2500)
    field: str = Field(min_length=2, max_length=120)
    seniority: str = Field(min_length=2, max_length=120)
    constraints: str = Field(default='', max_length=1000)
    consentExternalProcessing: bool = False


def availability():
    configured = os.getenv('MIYAR_ENABLE_EXPERT_REVIEW') == 'true'
    expires = os.getenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT', '')
    try:
        end = datetime.fromisoformat(expires.replace('Z', '+00:00'))
        active = configured and end.tzinfo is not None and end > datetime.now(timezone.utc)
    except ValueError:
        active = False
    return {'enabled': bool(active), 'expiresAt': expires if configured else None}


def install(app, sessions, secret, references, engine, slot):
    # One global row serializes quota reservations across workers and restarts.
    with sessions() as db:
        if db.get(ExpertReviewQuota, 'global') is None:
            db.add(ExpertReviewQuota(key='global', started=0, requests=0, last_request=0))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()

    def reserve(request):
        stamp = int(time.time())
        peer = request.client.host if request.client else 'unknown'
        identity = hmac.new(secret.encode(), ('expert-review:' + peer).encode(), hashlib.sha256).hexdigest()
        day = stamp // 86400 * 86400
        hour = stamp // 3600 * 3600
        with sessions() as db:
            total = db.scalar(select(ExpertReviewQuota).where(ExpertReviewQuota.key == 'global').with_for_update())
            if total.started != day:
                total.started, total.requests = day, 0
            if total.requests >= DAILY_LIMIT:
                raise HTTPException(429, 'انتهى الحد اليومي للتجربة. حاول غدًا.', headers={'Retry-After': str(day + 86400 - stamp)})
            visitor = db.get(ExpertReviewQuota, identity)
            if visitor is None:
                visitor = ExpertReviewQuota(key=identity, started=hour, requests=0, last_request=0)
                db.add(visitor)
            if visitor.last_request and stamp - visitor.last_request < COOLDOWN:
                raise HTTPException(429, 'انتظر قليلًا قبل إعادة التحليل.', headers={'Retry-After': str(COOLDOWN - (stamp - visitor.last_request))})
            if visitor.started != hour:
                visitor.started, visitor.requests = hour, 0
            if visitor.requests >= HOURLY_LIMIT:
                raise HTTPException(429, 'بلغت التجربة حد المحاولات لهذه الساعة. حاول لاحقًا.', headers={'Retry-After': str(hour + 3600 - stamp)})
            total.requests += 1
            total.last_request = stamp
            visitor.requests += 1
            visitor.last_request = stamp
            db.execute(delete(ExpertReviewQuota).where(ExpertReviewQuota.key != 'global', ExpertReviewQuota.started < stamp - 86400))
            db.commit()

    @app.get('/api/v1/review/strategic/status')
    def status():
        caps = capability()
        with sessions() as db:
            row = db.get(ExpertReviewQuota, 'global')
            used = row.requests if row and row.started == int(time.time()) // 86400 * 86400 else 0
        return {**availability(), 'configured': caps['configured'], 'mode': 'expert-review',
                'embeddingModel': caps['embeddingModel'], 'generationModel': caps['generationModel'],
                'corpusRecords': caps['corpusRecords'], 'dailyLimit': DAILY_LIMIT,
                'remainingToday': max(0, DAILY_LIMIT - used), 'hourlyLimit': HOURLY_LIMIT,
                'cooldownSeconds': COOLDOWN, 'organizationAccess': False,
                'inputStored': False, 'provider': 'Google Gemini'}

    @app.post('/api/v1/review/strategic')
    def analyze(body: ReviewRequest, request: Request):
        state = availability()
        if not state['enabled']:
            raise HTTPException(410, 'انتهت تجربة الخبراء أو لم تُفعّل بعد.')
        origins = {x.strip().rstrip('/') for x in os.getenv('MIYAR_CORS_ORIGINS', 'https://adeebnoor.github.io').split(',')}
        origins.add(str(request.base_url).rstrip('/'))
        if request.headers.get('origin', '').rstrip('/') not in origins:
            raise HTTPException(403, 'افتح صفحة اختبار الخبراء لإجراء التحليل.')
        if not body.consentExternalProcessing:
            raise HTTPException(422, 'وافق على إرسال نص المثال إلى Google Gemini قبل التحليل.')
        if not all(x.strip() for x in [body.text, body.field, body.seniority]):
            raise HTTPException(422, 'أكمل الهدف والمجال والمستوى المطلوب.')
        if not capability()['configured']:
            raise HTTPException(503, 'خدمة الذكاء الاصطناعي غير مهيأة حاليًا.')
        if not slot.acquire(blocking=False):
            raise HTTPException(429, 'المحرك يعالج طلبًا آخر. أعد المحاولة بعد قليل.', headers={'Retry-After': '20'})
        try:
            reserve(request)
            try:
                result = engine.analyze(body.model_dump(exclude={'consentExternalProcessing'}), references.occupations['nodes'], float(os.getenv('MIYAR_STRATEGIC_THRESHOLD', '.85')))
            except (Unavailable, ValueError):
                raise HTTPException(503, 'تعذّر إكمال التحليل لدى مزود الذكاء الاصطناعي. حاول بعد قليل؛ لم تُنشأ نتيجة بديلة.')
            caps = capability()
            return {**result, 'mode': 'expert-review', 'organizationAccess': False,
                    'embeddingModel': caps['embeddingModel'], 'generationModel': caps['generationModel'],
                    'completedAt': datetime.now(timezone.utc).isoformat()}
        finally:
            slot.release()
