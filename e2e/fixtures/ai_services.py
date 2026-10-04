"""Disposable browser acceptance API with deterministic, offline AI boundaries.

This fixture runs the real application, taxonomy retrieval, consent checks, KPI
schema validation, quota storage and HTTP routes. The vectors and provider replies
are explicitly synthetic: these tests do not measure live-provider accuracy.
"""
import json
import math
import os
import tempfile
import time
from datetime import datetime, timedelta, timezone

LOCAL_FIXTURE = os.getenv('MIYAR_AI_TEST_LOCAL') == 'true'
os.environ.update({
    'MIYAR_SERVE_UI': 'true',
    'MIYAR_ENABLE_EMBEDDINGS': 'true',
    'MIYAR_EMBEDDING_PROVIDER': 'local-e5-small' if LOCAL_FIXTURE else 'gemini',
    'MIYAR_EMBEDDING_MODEL': 'gemini-embedding-001',
    'MIYAR_STRATEGIC_GEMINI_KEY': 'synthetic-offline-provider-key',
    'MIYAR_KPI_PROVIDER': 'gemini',
    'MIYAR_KPI_MODEL': 'gemini-3.1-flash-lite',
    'MIYAR_ENABLE_EXPERT_REVIEW': 'true',
    'MIYAR_EXPERT_REVIEW_EXPIRES_AT': (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
    'MIYAR_EXPERT_REVIEW_DAILY_LIMIT': '2000',
    'MIYAR_EXPERT_REVIEW_HOURLY_LIMIT': '500',
})

import httpx
import numpy as np
from server import expert_review, performance, semantic_provider
from server.app import create_app
from server.taxonomy import Catalog

# No test invocation can send traffic to an external provider, even by mistake.
def forbidden_external_send(*args, **kwargs):
    raise RuntimeError('The AI browser fixture forbids external provider requests')

httpx.Client.send = forbidden_external_send
expert_review.COOLDOWN = 0  # Only the disposable fixture; production remains 20s.


def response(url, payload, code=200):
    return httpx.Response(code, json=payload, request=httpx.Request('POST', url))


def embedding_response(client, url, **kwargs):
    rows = kwargs['json']['requests']
    text = ' '.join(row['content']['parts'][0]['text'] for row in rows)
    if 'AI_TEST_DELAY' in text:
        time.sleep(.65)
    if 'AI_TEST_FAIL' in text:
        return response(url, {'error': 'Synthetic provider outage'}, 503)
    return response(url, {'embeddings': [{'values': [1.0] + [0.0] * 767} for _ in rows]})


def kpi_response(client, url, **kwargs):
    data = kwargs['json']
    content = json.loads(data['contents'][0]['parts'][0]['text'])
    measures = content['successMeasures']
    if 'AI_TEST_DELAY' in measures:
        time.sleep(.65)
    if 'AI_TEST_FAIL' in measures:
        return response(url, {'error': 'Synthetic provider outage'}, 503)
    arabic = 'Use Arabic.' in data['systemInstruction']['parts'][0]['text']
    rows = [{
        'outcome': ('مخرج تجريبي ' if arabic else 'Synthetic outcome ') + str(i + 1),
        'metric': {'kind':'percentage',
                   'label':'نسبة الطلبات المكتملة' if arabic else 'Percentage of completed requests',
                   'numerator':'الطلبات المكتملة المؤهلة' if arabic else 'Completed eligible requests',
                   'denominator':'جميع الطلبات المؤهلة للشهر' if arabic else 'All eligible monthly requests'},
        'target': '٩٥٪ هدف مقترح' if arabic else '95% proposed',
        'frequency': 'Monthly',
        'deliverable': 'Synthetic source register ' + str(i + 1),
    } for i in range(3)]
    return response(url, {'candidates': [{'finishReason': 'STOP', 'content': {
        'parts': [{'text': json.dumps({'kpis': rows}, ensure_ascii=False)}]}}]})


semantic_provider.provider_post = embedding_response
performance.provider_post = kpi_response

catalog = Catalog()
catalog.vector_roles = list(catalog.roles.values())
dimensions = 384 if LOCAL_FIXTURE else 768
catalog.matrix = np.zeros((len(catalog.vector_roles), dimensions), dtype=np.float32)
catalog.matrix[:, 1] = 1.0
# Real source codes and labels, with deliberately deterministic synthetic scores.
occupation_scores = [('251204', .99), ('241308', .9), ('251104', .8)]
if LOCAL_FIXTURE:
    occupation_scores += [('242114', .97), ('121313', .85)]
for code, score in occupation_scores:
    index = next(i for i, role in enumerate(catalog.vector_roles) if role['code'] == code)
    catalog.matrix[index, 0] = score
    catalog.matrix[index, 1] = math.sqrt(1 - score * score)
catalog.skill_matrix = np.zeros((len(catalog.skills), dimensions), dtype=np.float32)
catalog.skill_matrix[:, 1] = 1.0
# The unknown local scope deliberately proposes a transferable coordination
# skill; the separate Gemini baseline continues to propose Programming.
skill_id = 'onet:2.B.1.b' if LOCAL_FIXTURE else 'onet:2.B.3.e'
skill_index = next(i for i, skill in enumerate(catalog.skills) if skill['id'] == skill_id)
catalog.skill_matrix[skill_index, 0] = .96
catalog.skill_matrix[skill_index, 1] = math.sqrt(1 - .96 * .96)
class SyntheticLocalEmbeddings:
    """Deterministic local boundary only; never downloads or calls a provider."""
    name = 'intfloat/multilingual-e5-small'

    def embed(self, texts):
        return iter([[1.0] + [0.0] * (dimensions - 1) for _ in texts])


catalog.model = SyntheticLocalEmbeddings() if LOCAL_FIXTURE else semantic_provider.GeminiOccupationEmbeddings()
catalog.model_name = catalog.model.name
catalog.model_fingerprint = 'synthetic-browser-fixture-vectors-not-provider-accuracy'
catalog.semantic_index_status = 'ready'
catalog.semantic_indexed_documents = len(catalog.roles) + len(catalog.skills)

_directory = tempfile.TemporaryDirectory(prefix='miyar-ai-browser-')
app = create_app('sqlite:///' + _directory.name + '/test.db',
                 'isolated-ai-audit-key-not-for-production-928', catalog=catalog)
