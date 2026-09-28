import json
import httpx
from server import strategic_check as check


def test_provider_diagnostic_redacts_secrets():
    request = httpx.Request('POST', 'https://provider.invalid/?key=secret-value', headers={'x-goog-api-key': 'secret-value'})
    response = httpx.Response(400, request=request, json={'error': {'status': 'INVALID_ARGUMENT',
        'message': 'secret-value', 'details': [{'reason': 'API_KEY_INVALID', 'metadata': {'key': 'secret-value'}}]}})
    error = httpx.HTTPStatusError('secret-value', request=request, response=response)
    result = check.safe_failure(error)
    assert result == {'kind': 'provider-http-error', 'httpStatus': 400, 'providerStatus': 'INVALID_ARGUMENT', 'reasons': ['API_KEY_INVALID']}
    assert 'secret-value' not in json.dumps(result)


def test_live_check_does_not_pass_with_wrong_route(monkeypatch):
    monkeypatch.setattr(check, 'capability', lambda: {'configured': True, 'embeddingModel': 'test', 'generationModel': 'test'})
    class Engine:
        def analyze(self, context, occupations, threshold):
            return dict(route='matched-objective', cosineSimilarity=.99, threshold=threshold,
                        finalTitle='Civil Engineer', status='human-review-required', occupationCode='214201',
                        educationCode='073201', classificationStatus='source-linked-proposal', noveltyEstablished=False)
    result = check.run_check(Engine(), [])
    assert result['status'] == 'failed'
    assert result['cases'][0]['passed'] is True
    assert result['cases'][1]['checks']['expectedRoute'] is False
    assert result['cases'][1]['checks']['noInventedCode'] is False


def test_public_check_is_opt_in_and_cannot_trigger_provider(tmp_path, monkeypatch):
    monkeypatch.setattr(check, 'REPORT', tmp_path / 'check.json')
    check.save_report({'status': 'passed'})
    monkeypatch.delenv('MIYAR_STRATEGIC_STARTUP_CHECK', raising=False)
    assert check.public_report() == {}
    monkeypatch.setenv('MIYAR_STRATEGIC_STARTUP_CHECK', 'true')
    assert check.public_report() == {'providerSelfTest': {'status': 'passed'}}
