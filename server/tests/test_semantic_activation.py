"""Actual retrieval math and provider contracts, without production credentials."""
import json
import threading

import numpy as np
import pytest

from server.semantic_provider import GeminiOccupationEmbeddings, capability, DIMENSIONS, query_chunks, failure_details
from server.strategic import Unavailable
from server.taxonomy import Catalog


def configure(monkeypatch, tmp_path):
    for name, value in {'MIYAR_ENABLE_EMBEDDINGS': 'true', 'MIYAR_EMBEDDING_PROVIDER': 'gemini',
                        'MIYAR_STRATEGIC_EMBEDDING_MODEL': 'gemini-embedding-001',
                        'MIYAR_STRATEGIC_GEMINI_KEY': 'private-synthetic-test-key',
                        'MIYAR_MODEL_CACHE': str(tmp_path)}.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv('MIYAR_EMBEDDING_MODEL', raising=False)


def vector(a, b=0):
    return [a, b] + [0.] * (DIMENSIONS - 2)


def small_catalog():
    catalog = Catalog()
    catalog.roles = dict(list(catalog.roles.items())[:3])
    catalog.skills = catalog.skills[:2]
    return catalog


def provider(monkeypatch, payload):
    import server.semantic_provider as module
    seen = []

    class Response:
        content = b'{}'
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return payload

    class Client:
        def __init__(self, **kw):
            seen.append({'client': kw})

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kw):
            seen.append({'url': url, **kw})
            return Response()

    monkeypatch.setattr(module.httpx, 'Client', Client)
    return seen


def test_semantic_provider_is_explicit_and_keeps_credential_server_side(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    caps = capability()
    assert caps['configured'] and caps['provider'] == 'gemini' and caps['externalProcessing']
    assert caps['dimensions'] == 768 and 'private-synthetic' not in json.dumps(caps)
    monkeypatch.setenv('MIYAR_EMBEDDING_PROVIDER', 'unrecognized')
    assert not capability()['configured']
    monkeypatch.setenv('MIYAR_EMBEDDING_PROVIDER', 'gemini')
    monkeypatch.delenv('MIYAR_STRATEGIC_GEMINI_KEY')
    assert not capability()['configured']


@pytest.mark.parametrize('kind,task', [('query', 'RETRIEVAL_QUERY'), ('passage', 'RETRIEVAL_DOCUMENT')])
def test_gemini_retrieval_uses_real_ordered_768_vectors_and_manual_normalization(monkeypatch, tmp_path, kind, task):
    configure(monkeypatch, tmp_path)
    seen = provider(monkeypatch, {'embeddings': [{'values': vector(3)}, {'values': vector(0, 2)}]})
    result = GeminiOccupationEmbeddings()(['التحليل المالي', 'Risk review'], kind)
    assert result == [vector(1.), vector(0, 1.)]
    request = seen[1]
    assert request['url'].endswith('gemini-embedding-001:batchEmbedContents')
    assert request['headers'] == {'x-goog-api-key': 'private-synthetic-test-key'}
    assert request['json']['requests'][0]['content']['parts'][0]['text'] == 'التحليل المالي'
    assert all(row['taskType'] == task and row['outputDimensionality'] == 768 for row in request['json']['requests'])
    assert seen[0]['client']['follow_redirects'] is False


@pytest.mark.parametrize('rows', [[], [{'values': [1, 0]}], [{'values': vector(0)}],
                                  [{'values': vector(float('nan'))}], [{'values': vector(True)}]])
def test_invalid_or_incomplete_embedding_results_never_produce_scores(monkeypatch, tmp_path, rows):
    configure(monkeypatch, tmp_path)
    provider(monkeypatch, {'embeddings': rows})
    with pytest.raises(Unavailable):
        GeminiOccupationEmbeddings()(['Only a reference label'], 'query')


def test_provider_rejects_oversized_batches_before_network(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    provider(monkeypatch, {'embeddings': []})
    with pytest.raises(Unavailable):
        GeminiOccupationEmbeddings()(['A'] * 101, 'passage')


def fake_index(monkeypatch, calls, vectors=None):
    import server.taxonomy as module

    class Embeddings:
        name = 'gemini-embedding-001'
        fingerprint = 'synthetic-provider-fingerprint'
        dimensions = DIMENSIONS

        def __call__(self, texts, kind):
            calls.append((texts, kind))
            return vectors if vectors is not None else [vector(1.) for _ in texts]

        def embed(self, texts):
            calls.append((list(texts), 'query'))
            return iter([vector(1.)])

    monkeypatch.setattr(module, 'GeminiOccupationEmbeddings', Embeddings)


def test_full_reference_index_is_bounded_to_51_batches_and_cached_with_float32(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    calls = []
    fake_index(monkeypatch, calls)
    catalog = Catalog()
    assert len(catalog.roles) == 5041 and len(catalog.skills) == 37
    assert catalog.semantic_status()['modelReady'] is False
    with pytest.raises(RuntimeError, match='warming up'):
        catalog.semantic('Analyze reference scope')
    assert calls == []
    catalog.load_semantic()
    assert len(calls) == 51 and all(len(texts) <= 100 and kind == 'passage' for texts, kind in calls)
    status = catalog.semantic_status()
    assert status['modelReady'] and status['indexedDocuments'] == status['totalDocuments'] == 5078
    assert catalog.matrix.shape == (5041, 768) and catalog.skill_matrix.shape == (37, 768)
    assert catalog.matrix.dtype == np.float32
    second = Catalog()
    second.load_semantic()
    assert len(calls) == 51
    assert np.allclose(second.matrix, catalog.matrix)


def test_actual_cosine_retrieval_adds_reviewable_semantic_skills_without_fabricating_dictionary_evidence(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    calls = []
    fake_index(monkeypatch, calls, [vector(.6, .8), vector(0, 1), vector(-1), vector(1), vector(0, 1)])
    catalog = small_catalog()
    catalog.load_semantic()
    result = catalog.semantic('مراجعة الأدلة والمخاطر')
    assert result['candidates'][0]['cosineSimilarity'] == .6
    assert result['semanticSkills'][0]['id'] == catalog.skills[0]['id']
    assert result['semanticSkills'][0]['cosineSimilarity'] == 1
    assert result['semanticSkills'][0]['humanReviewRequired']
    assert result['extractedSkills'] == [] and not result['semanticSkillThresholdCalibrated']
    assert all(candidate['taskOverlapPercent'] is None for candidate in result['candidates'])
    selected = catalog.semantic('Review evidence', candidate_codes={list(catalog.roles)[1]})
    assert len(selected['candidates']) == 1 and selected['candidates'][0]['code'] == list(catalog.roles)[1]


def test_corrupt_cache_is_rebuilt_and_incomplete_index_never_becomes_ready(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    calls = []
    fake_index(monkeypatch, calls)
    catalog = small_catalog()
    catalog.load_semantic()
    filename = next(tmp_path.glob('*.npy'))
    filename.write_bytes(b'corrupt archive')
    second = small_catalog()
    second.load_semantic()
    assert len(calls) == 1 and second.semantic_status()['modelReady']
    filename.unlink()
    for part in tmp_path.glob('*-parts/*.npy'):
        part.unlink()
    import server.taxonomy as module

    class Failure:
        name = 'gemini-embedding-001'
        fingerprint = 'synthetic-provider-fingerprint'
        dimensions = DIMENSIONS

        def __call__(self, *args):
            error=RuntimeError('Private provider details must not escape')
            error.response=type('Response',(),{'status_code':429})()
            raise Unavailable('Provider failed with private-synthetic-test-key') from error

    monkeypatch.setattr(module, 'GeminiOccupationEmbeddings', Failure)
    third = small_catalog()
    with pytest.raises(Unavailable):
        third.load_semantic()
    status = third.semantic_status()
    assert not status['modelReady'] and status['indexStatus'] == 'failed'
    assert status['lastFailure']['upstreamStatus'] == 429
    assert 'private-synthetic' not in json.dumps(status)


def test_request_fails_fast_during_background_index_build(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    import server.taxonomy as module
    started = threading.Event()
    finish = threading.Event()

    class Delayed:
        name = 'gemini-embedding-001'
        fingerprint = 'synthetic-provider-fingerprint'
        dimensions = DIMENSIONS

        def __call__(self, texts, kind):
            started.set()
            assert finish.wait(timeout=5)
            return [vector(1) for text in texts]

    monkeypatch.setattr(module, 'GeminiOccupationEmbeddings', Delayed)
    catalog = small_catalog()
    worker = threading.Thread(target=catalog.load_semantic)
    worker.start()
    try:
        assert started.wait(timeout=5)
        assert catalog.semantic_status()['indexStatus'] == 'indexing'
        with pytest.raises(RuntimeError, match='warming up'):
            catalog.semantic('Risk analysis')
        assert catalog.model is None and catalog.matrix is None
    finally:
        finish.set()
        worker.join(timeout=5)
    assert catalog.semantic_status()['modelReady']


def test_long_multilingual_queries_preserve_final_context_with_at_most_14_chunks():
    text = ('مراجعة المخاطر وأدلة التدقيق. Review investment controls. ' * 300)[:15900] + ' FINAL_CONTEXT: no financial approval.'
    chunks = query_chunks(text)
    assert ''.join(chunks) == text
    assert all(len(chunk) <= 1200 for chunk in chunks) and len(chunks) <= 14
    assert 'FINAL_CONTEXT: no financial approval.' in chunks[-1]
    # Pathologically long words still respect the hard budget without dropping text.
    words = ('x' * 700 + ' ') * 22
    assert ''.join(query_chunks(words)) == words.strip()
    assert len(query_chunks(words)) <= 14
    with pytest.raises(Unavailable):
        query_chunks('x' * 16001)


def test_long_query_embeds_all_chunks_in_one_batch_and_pools_real_vectors_by_length(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    text = 'a' * 1200 + 'b' * 600
    seen = provider(monkeypatch, {'embeddings': [{'values': vector(1)}, {'values': vector(0, 1)}]})
    model = GeminiOccupationEmbeddings()
    pooled = next(model.embed([text]))
    assert np.allclose(pooled[:2], [2 / np.sqrt(5), 1 / np.sqrt(5)])
    assert len(seen) == 2
    requests = seen[1]['json']['requests']
    assert len(requests) == 2
    assert ''.join(row['content']['parts'][0]['text'] for row in requests) == text
    assert all(row['taskType'] == 'RETRIEVAL_QUERY' for row in requests)
    assert model.query_metadata(text) == {'queryChunks': 2, 'queryPooling': 'length-weighted-mean-normalized', 'queryChunkCharacters': 1200}


def test_quota_diagnostics_keep_only_public_metric_limit_scope_and_retry_delay():
    import httpx
    payload={'error':{'message':'secret key and project identity must stay private','details':[
        {'@type':'type.googleapis.com/google.rpc.QuotaFailure','violations':[
            {'quotaMetric':'generativelanguage.googleapis.com/embed_content_free_tier_requests',
             'quotaId':'EmbedContentRequestsPerMinutePerProjectPerUser-FreeTier','quotaValue':'100',
             'quotaDimensions':{'consumer':'projects/private-project'}}]},
        {'@type':'type.googleapis.com/google.rpc.RetryInfo','retryDelay':'41.25s'},
        {'@type':'type.googleapis.com/google.rpc.ErrorInfo','domain':'googleapis.com','metadata':{
            'quota_metric':'generativelanguage.googleapis.com/embed_content_free_tier_requests',
            'quota_limit':'EmbedContentRequestsPerDayPerProjectPerUser-FreeTier',
            'quota_limit_value':'1000','consumer':'private-project','api_key':'private-key'}}]}}
    response=httpx.Response(429,json=payload,headers={'Retry-After':'20'},request=httpx.Request('POST','https://generativelanguage.googleapis.com/example'))
    error=httpx.HTTPStatusError('Private URL and credentials must not escape',request=response.request,response=response)
    details=failure_details(error)
    assert details['upstreamStatus']==429 and details['retryAfterSeconds']==42
    assert details['quotas'][0]['limit']==100 and details['quotas'][0]['scope']=='minute'
    assert details['quotas'][1]['limit']==1000 and details['quotas'][1]['scope']=='day'
    assert 'private' not in json.dumps(details).lower()


def test_online_query_does_not_retry_provider_quota_errors(monkeypatch,tmp_path):
    configure(monkeypatch,tmp_path)
    import server.semantic_provider as module
    import httpx
    calls=[]
    response=httpx.Response(429,json={'error':{'message':'Private quota details'}},request=httpx.Request('POST','https://generativelanguage.googleapis.com/example'))
    class Client:
        def __init__(self,**kw):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def post(self,*args,**kw):calls.append(kw);return response
    monkeypatch.setattr(module.httpx,'Client',Client)
    with pytest.raises(Unavailable):
        next(GeminiOccupationEmbeddings().embed(['Review audit evidence']))
    assert len(calls)==1


def test_remote_index_resumes_completed_batches_after_quota_failure(monkeypatch,tmp_path):
    configure(monkeypatch,tmp_path)
    import server.taxonomy as module
    completed=[]
    class Interrupt:
        name='gemini-embedding-001';fingerprint='synthetic-resumable-index';dimensions=DIMENSIONS
        def __call__(self,texts,kind):
            completed.append(len(texts))
            if len(completed)>1:
                error=RuntimeError('Provider quota details are private')
                error.response=type('Response',(),{'status_code':429})()
                raise Unavailable('Quota is exhausted') from error
            return [vector(1) for text in texts]
    monkeypatch.setattr(module,'GeminiOccupationEmbeddings',Interrupt)
    first=Catalog();first.roles=dict(list(first.roles.items())[:201]);first.skills=first.skills[:2]
    with pytest.raises(Unavailable):first.load_semantic()
    assert first.semantic_status()['indexedDocuments']==100 and not first.semantic_status()['modelReady']
    assert len(list(tmp_path.glob('*-parts/*.npy')))==1
    resumed=[]
    class Continue:
        name=Interrupt.name;fingerprint=Interrupt.fingerprint;dimensions=DIMENSIONS
        def __call__(self,texts,kind):resumed.append(len(texts));return [vector(1) for text in texts]
    monkeypatch.setattr(module,'GeminiOccupationEmbeddings',Continue)
    second=Catalog();second.roles=dict(list(second.roles.items())[:201]);second.skills=second.skills[:2]
    second.load_semantic()
    assert resumed==[100,3]
    assert second.semantic_status()['modelReady'] and second.semantic_status()['indexedDocuments']==203
