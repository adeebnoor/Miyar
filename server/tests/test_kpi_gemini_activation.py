import json

import pytest

from server.performance import capability, generate_kpis

KPI = {'outcome': 'Reduce processing delay', 'metric': 'Median completion days',
       'target': 'Proposed: 20% below baseline within 90 days', 'frequency': 'Monthly',
       'deliverable': 'Timestamped process report'}
CONTENT = {'title': 'Synthetic Operations Specialist', 'field': 'Operations',
           'successMeasures': 'Reduce processing delay by 20% within 90 days',
           'responsibilities': 'Review processing records', 'purpose': 'Improve service delivery'}


def configure(monkeypatch):
    monkeypatch.setenv('MIYAR_KPI_PROVIDER', 'gemini')
    monkeypatch.setenv('MIYAR_STRATEGIC_GEMINI_KEY', 'private-synthetic-test-key')
    monkeypatch.setenv('MIYAR_STRATEGIC_GEMINI_MODEL', 'gemini-3.1-flash-lite')
    monkeypatch.delenv('MIYAR_KPI_MODEL', raising=False)
    monkeypatch.delenv('MIYAR_KPI_ENDPOINT', raising=False)


def provider(monkeypatch, result, finish='STOP'):
    import server.performance as module
    seen = []

    class Response:
        content = b'{}'
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {'candidates': [{'finishReason': finish, 'content': {'parts': [
                {'text': 'This thought must not become output', 'thought': True},
                {'text': json.dumps(result, ensure_ascii=False)}]}}]}

    class Client:
        def __init__(self, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kw):
            seen.append({'url': url, **kw})
            return Response()

    monkeypatch.setattr(module.httpx, 'Client', Client)
    return seen


@pytest.mark.parametrize('lang,language', [('ar', 'Arabic'), ('en', 'English')])
def test_opt_in_gemini_kpis_use_schema_and_bounded_job_data_only(monkeypatch, lang, language):
    configure(monkeypatch)
    seen = provider(monkeypatch, {'kpis': [KPI] * 3})
    assert capability()['configured'] and capability()['model'] == 'gemini-3.1-flash-lite'
    assert 'private-synthetic' not in json.dumps(capability())
    rows = generate_kpis({**CONTENT, 'employeeIdentity': 'must not be sent'}, lang)
    assert rows == [KPI] * 3
    request = seen[0]
    assert request['url'].endswith('gemini-3.1-flash-lite:generateContent')
    assert request['headers'] == {'x-goog-api-key': 'private-synthetic-test-key'}
    prompt = request['json']['systemInstruction']['parts'][0]['text']
    assert language in prompt and 'untrusted job data' in prompt and 'proposed' in prompt
    data = json.loads(request['json']['contents'][0]['parts'][0]['text'])
    assert data['successMeasures'] == CONTENT['successMeasures'] and 'employeeIdentity' not in data
    schema = request['json']['generationConfig']['responseJsonSchema']
    assert schema['properties']['kpis']['minItems'] == 3 and schema['properties']['kpis']['maxItems'] == 5
    assert schema['additionalProperties'] is False


@pytest.mark.parametrize('result', [{'kpis': []}, {'kpis': [KPI] * 6}, {'kpis': [{**KPI, 'approved': 'yes'}] * 3},
                                    {'kpis': [{**KPI, 'target': 20}] * 3}, {'kpis': [KPI] * 3, 'approval': True},
                                    {'kpis': [{**KPI, 'target': ''}] * 3}, []])
def test_invalid_gemini_kpi_payload_is_rejected_without_fabricated_output(monkeypatch, result):
    configure(monkeypatch)
    provider(monkeypatch, result)
    with pytest.raises(ValueError, match='no results were fabricated'):
        generate_kpis(CONTENT, 'en')


def test_kpi_generation_requires_explicit_provider_valid_config_success_measures_and_finished_response(monkeypatch):
    configure(monkeypatch)
    monkeypatch.delenv('MIYAR_KPI_PROVIDER')
    assert not capability()['configured']
    with pytest.raises(ValueError, match='not configured'):
        generate_kpis(CONTENT, 'en')
    configure(monkeypatch)
    provider(monkeypatch, {'kpis': [KPI] * 3})
    with pytest.raises(ValueError, match='success measures'):
        generate_kpis({**CONTENT, 'successMeasures': ' '}, 'en')
    provider(monkeypatch, {'kpis': [KPI] * 3}, finish='MAX_TOKENS')
    with pytest.raises(ValueError, match='no results were fabricated'):
        generate_kpis(CONTENT, 'en')
    monkeypatch.setenv('MIYAR_STRATEGIC_GEMINI_MODEL', 'invalid/model')
    assert not capability()['configured']
