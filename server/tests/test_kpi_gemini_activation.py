import json

import pytest

from server.performance import capability, generate_kpis, validate_kpis, normalize_percentage_metric

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
    assert '× 100' in prompt and 'same eligible cohort and measurement period' in prompt
    assert 'including overdue unfinished cases' in prompt and 'receipt of ALL required documents' in prompt
    assert 'calendar days versus working days' in prompt
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


@pytest.mark.parametrize('metric,expected', [
    ('Percentage of due-diligence files completed within 30 days (Number of files completed within 30 days / Total number of files received)',
     'Percentage of due-diligence files completed within 30 days (Number of files completed within 30 days / Total number of files received) × 100'),
    ('نسبة ملفات الفحص المكتملة خلال 30 يوماً (عدد الملفات المكتملة في الموعد ÷ إجمالي الملفات المستحقة خلال الشهر)',
     'نسبة ملفات الفحص المكتملة خلال 30 يوماً (عدد الملفات المكتملة في الموعد ÷ إجمالي الملفات المستحقة خلال الشهر) × 100'),
    ('Percentage of complete investment papers: complete papers / submitted papers',
     'Percentage of complete investment papers: (complete papers / submitted papers) × 100'),
    ('نسبة اكتمال الأدلة = الأدلة المكتملة ÷ الأدلة المستحقة',
     'نسبة اكتمال الأدلة = (الأدلة المكتملة ÷ الأدلة المستحقة) × 100'),
])
def test_clear_percentage_ratios_receive_only_missing_scaling_without_changing_operands(metric, expected):
    assert normalize_percentage_metric(metric) == expected
    row = {**KPI, 'metric': metric, 'target': '95%'}
    normalized = validate_kpis([row] * 3)
    assert normalized == [{**row, 'metric': expected}] * 3
    assert row['metric'] == metric  # Do not mutate the provider result or shared rows.
    assert all(value['target'] == '95%' for value in normalized)


@pytest.mark.parametrize('metric', [
    'Median completion days',
    'متوسط أيام إكمال المعاملة',
    'Number of completed files (completed files / working days)',
    'عدد الملفات المكتملة خلال الشهر',
    'Median completion days (20% improvement target)',
    'Percentage-point improvement from baseline',
    'Percentage of completed cases',
    'Percentage of completed cases ( / eligible cases)',
    'Percentage of completed cases (completed cases / )',
    'Percentage of completed cases ((eligible completions) / eligible cases)',
    'Percentage of completed cases (completions / receipts / months)',
    'Percentage of completed cases (completed cases / eligible cases) × 1000',
    'Percentage of completed cases (completed cases / eligible cases) × 0.01',
])
def test_ambiguous_formulas_and_nonpercentage_units_are_not_rewritten_or_inferred_from_target(metric):
    row = {**KPI, 'metric': metric, 'target': 'Proposed: 20% below baseline within 90 days'}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('scale', ['× 100', '*100', 'x100', 'X 100', '× ١٠٠', 'multiplied by 100', 'مضروبة في ١٠٠'])
def test_existing_percentage_scale_is_never_applied_twice(scale):
    metric = 'Percentage of eligible cases (completed eligible cases / eligible cases) ' + scale
    assert normalize_percentage_metric(metric) == metric


def test_normalization_preserves_existing_structural_response_size_limit():
    metric = 'Percentage of cases (' + 'eligible completed case ' * 60 + '/ eligible cases)'
    metric += ' ' * (1500 - len(metric))
    assert len(metric) == 1500
    with pytest.raises(ValueError, match='field limit'):
        validate_kpis([{**KPI, 'metric': metric}] * 3)


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_live_style_percentage_response_is_normalized_with_one_provider_call_and_cohort_untouched(monkeypatch, lang):
    configure(monkeypatch)
    metric = ('Percentage of due-diligence files completed within 30 days '
              '(Number of files completed within 30 days / Total number of files received)') if lang == 'en' else (
              'نسبة ملفات الفحص المكتملة خلال 30 يوماً (عدد الملفات المكتملة خلال 30 يوماً ÷ إجمالي الملفات المستلمة)')
    row = {**KPI, 'metric': metric, 'target': '95%'}
    seen = provider(monkeypatch, {'kpis': [row] * 4})
    content = {**CONTENT, 'successMeasures': 'Complete at least 95% of due-diligence files within 30 calendar days of receiving all required documents.'}
    result = generate_kpis(content, lang)
    assert len(seen) == 1 and result == [{**row, 'metric': metric + ' × 100'}] * 4
    # Scaling normalization intentionally does not repair an unverified cohort.
    assert all('received' in r['metric'] if lang == 'en' else 'المستلمة' in r['metric'] for r in result)
    data = json.loads(seen[0]['json']['contents'][0]['parts'][0]['text'])
    assert data['successMeasures'] == content['successMeasures']
