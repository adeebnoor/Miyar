"""Exercise the prebuilt local model and real API within the free-instance budget.

Run ``python -m server.build_semantic_index`` first with the same MIYAR_MODEL_CACHE.
This separate process uses synthetic inputs and a disposable SQLite database. It
does not load the Rust tokenizer oracle, create accounts, or call an AI provider.
The JSON report records resource use and interface checks, not retrieval accuracy.
"""
import json
import math
import os
import resource
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

# ONNX Runtime 1.30 can initialize telemetry during import. Opt out beforehand.
os.environ['ORT_DISABLE_TELEMETRY'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['MIYAR_ENABLE_EMBEDDINGS'] = 'true'
os.environ['MIYAR_EMBEDDING_PROVIDER'] = 'local-e5-small'
os.environ['MIYAR_EMBEDDING_MODEL'] = 'intfloat/multilingual-e5-small'
os.environ['MIYAR_ENV'] = 'test'
os.environ['MIYAR_SERVE_UI'] = 'false'
os.environ['MIYAR_ENABLE_EXPERT_REVIEW'] = 'true'
os.environ['MIYAR_EXPERT_REVIEW_EXPIRES_AT'] = (
    datetime.now(timezone.utc) + timedelta(hours=1)
).isoformat()
os.environ['MIYAR_CORS_ORIGINS'] = 'http://testserver'

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
MAX_PEAK_BYTES = 500 * 1024 * 1024


def peak_bytes():
    if not sys.platform.startswith('linux'):
        raise RuntimeError('This resource gate requires Linux ru_maxrss units')
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024


def current_rss_bytes():
    for line in Path('/proc/self/status').read_text().splitlines():
        if line.startswith('VmRSS:'):
            return int(line.split()[1]) * 1024
    raise RuntimeError('Linux RSS measurement is unavailable')


def save_report(report):
    destination = ROOT / 'test-results' / 'local-semantic-resources.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(report, ensure_ascii=False)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                         dir=destination.parent,
                                         prefix='.local-semantic-resources-', suffix='.tmp',
                                         delete=False) as output:
            temporary = Path(output.name)
            output.write(encoded + '\n')
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return encoded


def checked_semantic(result, catalog):
    assert result['provider'] == 'local-e5-small', 'The configured local adapter was not used'
    assert result['model'] == 'intfloat/multilingual-e5-small'
    assert result['semanticSkillCorpusRecords'] == 37
    assert result['semanticSkillThresholdCalibrated'] is False
    candidates = result['candidates']
    assert len(candidates) == 3, 'Three occupation candidates are required'
    for row in candidates:
        assert row['code'] in catalog.roles, 'Candidate code is outside the selected source'
        assert row['taskOverlapPercent'] is None, 'Unavailable task overlap must remain null'
        assert math.isfinite(row['cosineSimilarity']) and -1 <= row['cosineSimilarity'] <= 1
        assert math.isfinite(row['semanticDistance']) and 0 <= row['semanticDistance'] <= 2
        if row['profile'] is None:
            assert row['skillOverlapPercent'] is None, 'Missing profiles must not fabricate overlap'
    skill_ids = {row['id'] for row in catalog.skills}
    suggestions = result['semanticSkills']
    assert 1 <= len(suggestions) <= 5, 'The local skill vocabulary produced no reviewable suggestions'
    for row in suggestions:
        assert row['id'] in skill_ids and row['humanReviewRequired'] is True
        assert math.isfinite(row['cosineSimilarity']) and -1 <= row['cosineSimilarity'] <= 1
    return {
        'candidateCodes': [row['code'] for row in candidates],
        'skillSuggestionCount': len(suggestions),
        'queryChunks': result['queryChunks'],
        'taskOverlapNull': True,
        'sourceCodesValid': True,
        'humanReviewRequired': True,
    }


def main():
    started = time.monotonic()
    report = {
        'status': 'running',
        'scope': 'Synthetic local-provider API and resource verification; not an accuracy evaluation',
        'peakLimitBytes': MAX_PEAK_BYTES,
        'telemetryDisabledBeforeImport': True,
        'externalProviderCalls': 0,
        'organizationAccountsCreated': 0,
        'checks': [],
    }
    stage = 'prebuilt-cache'
    try:
        from server.app import SemanticRequest, create_app
        from server.local_semantic_provider import encode_sentencepiece, token_windows
        from server.security import password_hash, verify_password
        from server.taxonomy import Catalog
        from fastapi.testclient import TestClient
        import psycopg  # Include the production database client, without opening a connection.

        cache = Path(os.environ.get('MIYAR_MODEL_CACHE', str(ROOT / '.model-cache')))
        files_before = {p.name: (p.stat().st_size, p.stat().st_mtime_ns)
                        for p in cache.glob('local-e5-corpus-vectors-*.npy')}
        assert files_before, 'Build the local semantic index before running this check'

        # Python-level network use is prohibited in this serving check. TestClient
        # transports requests in process; model downloads belong to the build step.
        with patch('socket.create_connection', side_effect=RuntimeError('Network is disabled in the local resource check')):
            stage = 'load-canonical-adapter'
            catalog = Catalog()
            catalog.load_semantic()
            status = catalog.semantic_status()
            assert status['modelReady'] and status['indexStatus'] == 'ready'
            assert status['configured'] and status['externalProcessing'] is False
            assert status['indexedDocuments'] == status['totalDocuments'] == 5078
            assert status['occupationRecords'] == 5041 and status['skillRecords'] == 37
            assert status['dimensions'] == 384
            assert catalog.matrix.shape == (5041, 384) and catalog.skill_matrix.shape == (37, 384)
            assert not catalog.matrix.flags.writeable and not catalog.skill_matrix.flags.writeable
            report['index'] = {
                'provider': status['provider'], 'model': status['model'],
                'documents': status['indexedDocuments'], 'occupations': status['occupationRecords'],
                'skills': status['skillRecords'], 'dimensions': status['dimensions'],
                'matrixBytes': catalog.matrix.nbytes + catalog.skill_matrix.nbytes,
                'modelFingerprint': catalog.model_fingerprint,
                'artifactVerification': 'pinned-size-and-sha256-before-session',
            }

            with tempfile.TemporaryDirectory(prefix='miyar-local-resource-') as directory:
                app = create_app('sqlite:///' + str(Path(directory) / 'synthetic.db'),
                                 jwt_secret='synthetic-resource-check-secret-at-least-32-characters',
                                 catalog=catalog)
                examples = [
                    ('ar', 'أراجع أنظمة الرقابة الداخلية وأخطط للمراجعة بناءً على المخاطر وأوثق أدلة المراجعة وأقدم تقارير مستقلة للجنة المراجعة.'),
                    ('en', 'Analyze investment opportunities, prepare financial models, evaluate valuation and portfolio risk, and report proposed investment decisions.'),
                ]
                for language, text in examples:
                    stage = 'public-semantic-' + language
                    # Separate synthetic peers exercise the real quota behavior
                    # without changing production cooldown or sleeping in CI.
                    with TestClient(app, client=('synthetic-resource-' + language, 50000)) as client:
                        health = client.get('/health')
                        assert health.status_code == 200
                        assert health.json()['services']['skillsSemantic']['modelReady']
                        response = client.post('/api/v1/review/semantic',
                                               headers={'Origin': 'http://testserver'},
                                               json={'text': text, 'consentExternalProcessing': False})
                        assert response.status_code == 200, 'Local public semantic API did not succeed'
                        result = response.json()
                        assert result['organizationAccess'] is False and result['inputStored'] is False
                        report['checks'].append({'name': stage, 'httpStatus': response.status_code,
                                                 **checked_semantic(result, catalog)})

                stage = 'maximum-organizational-query'
                final_context = ' FINAL_CONTEXT_FOR_STRATEGY_PMO_REVIEW'
                sentence = 'أحلل مخاطر الاستثمار وأخطط للقوى العاملة وأراجع الاستراتيجية وحوكمة المشاريع. '
                maximum_text = (sentence * (12000 // len(sentence) + 1))[:12000 - len(final_context)] + final_context
                request = SemanticRequest(text=maximum_text,
                                          field=('Human resources and investment planning ' * 10)[:200],
                                          seniority=('Senior strategy and project governance ' * 10)[:200],
                                          constraints='c' * 4000)
                retrieval = request.retrieval_text()
                assert len(request.text) == 12000 and len(request.field) == len(request.seniority) == 200
                assert len(retrieval) == 12420
                tokenizer = catalog.model.state.tokenizer
                with catalog.model.state.lock:
                    windows = token_windows(tokenizer, retrieval, 'query')
                    prefix_ids = encode_sentencepiece(tokenizer, 'query:')
                    expected = encode_sentencepiece(tokenizer, 'query: ' + retrieval)[len(prefix_ids):]
                recovered = [token for ids, weight in windows for token in ids[1 + len(prefix_ids):-1]]
                assert recovered == expected, 'Long query lost or altered encoded context'
                assert len(windows) > 1 and all(len(ids) <= 256 for ids, weight in windows)
                assert all(ids[0] == 0 and ids[-1] == 2 and ids[1:1 + len(prefix_ids)] == prefix_ids
                           for ids, weight in windows)
                result = catalog.semantic(retrieval)
                assert result['queryChunks'] == len(windows)
                report['checks'].append({'name': stage, 'inputCharacters': len(retrieval),
                                         'encodedBodyTokens': len(expected), 'tokenContextPreserved': True,
                                         'maximumSequenceTokens': 256, **checked_semantic(result, catalog)})

                stage = 'public-arabic-pdf'
                with TestClient(app, client=('synthetic-resource-pdf', 50000)) as client:
                    response = client.post('/api/v1/public/position-pdf', json={
                        'lang': 'ar', 'content': {
                            'title': 'منصب اصطناعي للتحقق من خدمات الموارد البشرية',
                            'purpose': 'التحقق من التصدير العربي بعد تشغيل المطابقة الدلالية المحلية.',
                            'responsibilities': 'مراجعة مدخلات المثال\nتوثيق نتائج التحقق\nإعداد بطاقة للمراجعة البشرية',
                            'businessNeed': 'مثال اصطناعي لفحص الإصدار؛ لا يمثل طلب توظيف أو اعتمادًا مؤسسيًا.',
                            'headcount': 1,
                        },
                    })
                    assert response.status_code == 200, 'The actual public PDF route did not succeed'
                    assert response.headers['content-type'].startswith('application/pdf')
                    assert response.headers['cache-control'] == 'no-store'
                    assert response.content.startswith(b'%PDF-') and len(response.content) > 1000
                    report['checks'].append({'name': stage, 'httpStatus': response.status_code,
                                             'pdfBytes': len(response.content), 'draftNotCached': True})

                stage = 'password-after-pdf-and-long-query'
                synthetic_password = 'Synthetic!LocalResourceMeasurement2026'
                encoded = password_hash(synthetic_password)
                assert verify_password(synthetic_password, encoded)
                assert not verify_password('Synthetic!IncorrectPassword2026', encoded)
                report['checks'].append({'name': stage, 'hashAndVerify': True,
                                         'incorrectPasswordRejected': True})

            files_after = {p.name: (p.stat().st_size, p.stat().st_mtime_ns)
                           for p in cache.glob('local-e5-corpus-vectors-*.npy')}
            assert files_after == files_before, 'Serving rebuilt or changed the prebuilt index'
            assert 'tokenizers' not in sys.modules and 'fastembed' not in sys.modules, 'Serving imported a large tokenizer/model registry'
            report['prebuiltIndexReused'] = True
            report['largeTokenizerOracleLoaded'] = False

        stage = 'resource-budget'
        report['rssBytes'] = current_rss_bytes()
        report['peakRssBytes'] = peak_bytes()
        report['peakBelowLimit'] = report['peakRssBytes'] < MAX_PEAK_BYTES
        assert report['peakBelowLimit'], 'Local semantic/API/PDF/password work exceeded the 500 MiB memory gate'
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['failure'] = {'stage': stage, 'kind': type(error).__name__}
        if isinstance(error, AssertionError):
            report['failure']['reason'] = str(error)
        report['peakRssBytes'] = peak_bytes()
    finally:
        report['elapsedSeconds'] = round(time.monotonic() - started, 3)
        print(save_report(report), flush=True)
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
