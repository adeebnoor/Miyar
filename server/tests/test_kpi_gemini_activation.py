import json
import logging

import pytest

from server.performance import capability, generate_kpis, validate_kpis, normalize_percentage_metric, KpiFormulaError

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


def provider(monkeypatch, result, finish='STOP', responses=None):
    import server.performance as module
    seen = []

    class Response:
        content = b'{}'
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            payload=responses[min(len(seen)-1,len(responses)-1)] if responses is not None else result
            return {'candidates': [{'finishReason': finish, 'content': {'parts': [
                {'text': 'This thought must not become output', 'thought': True},
                {'text': json.dumps(payload, ensure_ascii=False)}]}}]}

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
    assert 'all explicit mandatory components and AND/OR conditions' in prompt
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
    seen=provider(monkeypatch, result)
    with pytest.raises(ValueError, match='no results were fabricated'):
        generate_kpis(CONTENT, 'en')
    assert len(seen)==1  # Structural defects never trigger a formula correction.


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
    ('Percentage of complete papers (complete eligible papers divided by eligible submitted papers)',
     'Percentage of complete papers (complete eligible papers divided by eligible submitted papers) × 100'),
    ('نسبة اكتمال الملفات (عدد الملفات المكتملة مقسوماً على عدد الملفات المستحقة)',
     'نسبة اكتمال الملفات (عدد الملفات المكتملة مقسوماً على عدد الملفات المستحقة) × 100'),
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
    'Percentage points improvement from baseline',
    'Percentagepoints improvement from baseline',
    'التغير بالنقاط المئوية عن خط الأساس',
    'التحسن بنقطةمئوية عن خط الأساس',
])
def test_ambiguous_formulas_and_nonpercentage_units_are_not_rewritten_or_inferred_from_target(metric):
    row = {**KPI, 'metric': metric, 'target': 'Proposed: 20% below baseline within 90 days'}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('metric', [
    'Percentage of completed cases',
    'Percentage of completed cases × 100',
    'Percentage of completed cases ( / eligible cases)',
    'Percentage of completed cases (completed cases / )',
    'Percentage of completed cases ((eligible completions) / eligible cases)',
    'Percentage of completed cases (completions / receipts / months)',
    'Percentage of completed cases (completed cases / eligible cases) × 1000',
    'Percentage of completed cases (completed cases / eligible cases) × 0.01',
])
def test_explicit_percentage_without_complete_unambiguous_scaled_formula_fails_closed(metric):
    assert normalize_percentage_metric(metric)==metric
    with pytest.raises(KpiFormulaError) as failure:
        validate_kpis([KPI, {**KPI,'metric':metric}, KPI])
    assert failure.value.row_indices==(2,)
    assert metric not in str(failure.value)


@pytest.mark.parametrize('scale', ['× 100', '*100', 'x100', 'X 100', '× ١٠٠', 'multiplied by 100', 'مضروبة في ١٠٠'])
def test_existing_percentage_scale_is_never_applied_twice(scale):
    metric = 'Percentage of eligible cases (completed eligible cases / eligible cases) ' + scale
    assert normalize_percentage_metric(metric) == metric


@pytest.mark.parametrize('metric', [
    'Percentage of completed cases (completed cases / eligible cases) × 100.5',
    'Percentage of completed cases (completed cases / eligible cases) × 100,5',
    'Percentage of completed cases (completed cases / eligible cases) × 100e2',
    'Percentage of completed cases (completed cases / eligible cases) × 100%',
    'Percentage of completed cases (completed cases / eligible cases × 100)',
    'Percentage of completed cases (completed cases × 100 / eligible cases)',
    'Percentage × 100 of completed cases (completed cases / eligible cases)',
    'Percentage of completed cases (completed cases / eligible cases) × 100 × 0.01',
    'Percentage of completed cases (completed cases / eligible cases) × 100 + 3',
    'Percentage of completed cases (completed cases / eligible cases) × 100 - 3',
    'Percentage of completed cases: completed cases / eligible cases × 100.5',
    'نسبة إغلاق الحالات (الحالات المغلقة ÷ الحالات المؤهلة) × ١٠٠٫٥',
    'نسبة إغلاق الحالات (الحالات المغلقة ÷ الحالات المؤهلة × ١٠٠)',
    'نسبة إغلاق الحالات (الحالات المغلقة ÷ الحالات المؤهلة) × ١٠٠ × ٠٫٠١',
])
def test_wrong_scale_position_or_additional_arithmetic_is_rejected_without_rewriting(metric):
    assert normalize_percentage_metric(metric) == metric
    with pytest.raises(KpiFormulaError) as failure:
        validate_kpis([KPI, {**KPI, 'metric': metric}, KPI])
    assert failure.value.row_indices == (2,)


@pytest.mark.parametrize('metric', [
    'Percentage of completed cases (completed cases / eligible cases) × 100.0',
    'Percentage of completed cases (completed cases / eligible cases) multiplied by 100 per month',
    'Percentage of completed cases: completed cases / eligible cases × 100',
    'Percentage of completed cases = completed cases divided by eligible cases times 100; reviewed monthly',
    'نسبة إغلاق الحالات (الحالات المغلقة ÷ الحالات المؤهلة) × ١٠٠٫٠',
    'نسبة إغلاق الحالات = الحالات المغلقة ÷ الحالات المؤهلة مضروبة في ١٠٠',
])
def test_exact_scale_after_complete_ratio_preserves_valid_natural_language_and_decimal_zero(metric):
    row = {**KPI, 'metric': metric}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('metric,target', [
    ('عدد الافتراضات الموثقة في السجل القابل للمراجعة', '100% من الافتراضات المستخدمة في التخطيط كهدف مقترح'),
    ('متوسط أيام المعالجة', '٩٥٪ من المعاملات خلال ثلاثين يوماً'),
    ('Number of documented assumptions', 'Proposed: 100% of assumptions used in planning'),
    ('Median completion days', 'At least 95 percent of eligible cases'),
    ('Number of documented assumptions', 'توثيق ١٠٠ بالمئة من الافتراضات'),
    ('Number of completed cases', '20% reduction and at least 95% of cases completed on time'),
    ('عدد الحالات المتأخرة', 'خفض بنسبة ٢٠٪ وتوثيق ١٠٠٪ من الافتراضات'),
    ('Completed cases (completed cases / eligible cases)', 'Proposed: 95%'),
])
def test_absolute_percentage_targets_reject_unscaled_count_or_duration_metrics_without_inference(metric, target):
    row = {**KPI, 'metric': metric, 'target': target}
    with pytest.raises(KpiFormulaError) as failure:
        validate_kpis([KPI, row, KPI])
    assert failure.value.row_indices == (2,)
    assert row['metric'] == metric and row['target'] == target


@pytest.mark.parametrize('metric,target', [
    ('Number of documented assumptions', 'Proposed 20% reduction within 90 days'),
    ('Median completion days', 'Proposed: 20% below baseline within 90 days'),
    ('Number of documented assumptions', 'Reduce undocumented assumptions by 20% within 90 days'),
    ('Median completion days', 'Improve processing time by 20 percent'),
    ('عدد الحالات المتأخرة', 'خفض بنسبة 20% خلال تسعين يوماً'),
    ('متوسط أيام المعالجة', 'خفض مدة المعالجة بنسبة ٢٠٪ خلال تسعين يوماً'),
    ('عدد الافتراضات الموثقة', 'زيادة الافتراضات الموثقة بنسبة ١٠ بالمئة'),
    ('Number of documented assumptions', 'At least 40 documented assumptions'),
    ('متوسط أيام المعالجة', 'أقل من ثلاثين يوماً'),
    ('Percentage-point improvement from baseline', '20 percentage points improvement'),
])
def test_explicit_relative_percentage_changes_and_nonpercentage_targets_preserve_count_duration_units(metric, target):
    row = {**KPI, 'metric': metric, 'target': target}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('metric,target', [
    ('(Number of documented assumptions / Total eligible assumptions used in planning) × 100', 'Proposed: 100%'),
    ('Documented assumptions: (documented eligible assumptions / total eligible assumptions) × 100', 'Proposed: 95 percent'),
    ('(عدد الافتراضات الموثقة ÷ إجمالي الافتراضات المستخدمة في التخطيط) × ١٠٠', '١٠٠٪ من الافتراضات'),
])
def test_complete_proportional_formulas_without_percentage_label_accept_absolute_percentage_targets(metric, target):
    row = {**KPI, 'metric': metric, 'target': target}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('metric', [
    'Completed eligible cases / All eligible cases × 100',
    'Completed eligible cases divided by All eligible cases multiplied by 100',
    'عدد الطلبات المكتملة المؤهلة ÷ إجمالي الطلبات المؤهلة × ١٠٠',
    'عدد الطلبات المكتملة المؤهلة مقسوماً على إجمالي الطلبات المؤهلة مضروبة في 100',
])
def test_bare_complete_ratio_with_one_final_exact_scale_accepts_absolute_percentage_target(metric):
    row = {**KPI, 'metric': metric, 'target': '95% proposed'}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('metric', [
    'Completed cases / Eligible cases × 100.5',
    'Completed cases / Eligible cases × 100 × 0.01',
    'Completed cases × 100 / Eligible cases',
    'Completed cases / (Eligible cases × 100)',
    'Completed cases / Eligible cases × 100 + 3',
    'Completed cases / Eligible cases × 1000',
    'عدد الحالات المكتملة ÷ إجمالي الحالات × ١٠٠٫٥',
    'عدد الحالات المكتملة ÷ إجمالي الحالات × ١٠٠ × ٠٫٠١',
])
def test_bare_ratio_still_rejects_incorrect_scale_position_or_additional_arithmetic(metric):
    with pytest.raises(KpiFormulaError):
        validate_kpis([{**KPI, 'metric': metric, 'target': '95% proposed'}] * 3)


@pytest.mark.parametrize('target', ['20% تحسن عن خط الأساس', '٢٠٪ انخفاض عن خط الأساس', '20% أقل من خط الأساس'])
def test_explicit_arabic_relative_suffix_targets_preserve_duration_units(target):
    row = {**KPI, 'metric': 'متوسط أيام المعالجة', 'target': target}
    assert validate_kpis([row] * 3) == [row] * 3


@pytest.mark.parametrize('target', ['20% تحسن عن خط الأساس؛ وتوثيق 100% من الافتراضات', '٢٠٪ انخفاض عن خط الأساس مع تغطية ٩٥٪ من الطلبات'])
def test_arabic_relative_suffix_does_not_exempt_an_independent_absolute_target(target):
    with pytest.raises(KpiFormulaError):
        validate_kpis([{**KPI, 'metric': 'متوسط أيام المعالجة', 'target': target}] * 3)


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


@pytest.mark.parametrize('lang', ['en','ar'])
def test_observed_third_row_formula_omission_gets_one_bounded_correction_with_static_feedback(monkeypatch,lang):
    configure(monkeypatch)
    missing=('Percentage of valuation models reviewed by senior staff that meet internal quality standards'
             if lang=='en' else 'نسبة نماذج التقييم المراجعة التي تستوفي معايير الجودة الداخلية')
    corrected=(missing+' (models meeting quality standards / eligible reviewed models) × 100'
               if lang=='en' else missing+' (النماذج المستوفية لمعايير الجودة ÷ النماذج المراجعة المؤهلة) × 100')
    bad={**KPI,'outcome':'GENERATED_CONTENT_MUST_NOT_BE_FORWARDED','metric':missing,'target':'Proposed: 90% for manager review'}
    good={**bad,'metric':corrected}
    rows=[KPI,KPI,bad,KPI]
    seen=provider(monkeypatch,None,responses=[{'kpis':rows},{'kpis':[KPI,KPI,good,KPI]}])
    result=generate_kpis(CONTENT,lang)
    assert result==[KPI,KPI,good,KPI] and len(seen)==2
    first,second=seen
    assert first['json']['generationConfig']==second['json']['generationConfig']
    assert first['json']['contents']==second['json']['contents']
    feedback=second['json']['systemInstruction']['parts'][0]['text']
    assert 'in rows 3.' in feedback and 'Server validation feedback' in feedback
    assert missing not in feedback and bad['outcome'] not in feedback


def test_repeated_percentage_formula_omission_stops_after_one_correction_without_fabrication(monkeypatch):
    configure(monkeypatch)
    bad={**KPI,'metric':'Percentage of valuation models reviewed that meet quality standards','target':'Proposed: 90%'}
    seen=provider(monkeypatch,{'kpis':[KPI,KPI,bad]})
    with pytest.raises(ValueError,match='no results were fabricated') as failure:
        generate_kpis(CONTENT,'en')
    assert len(seen)==2
    assert isinstance(failure.value.__cause__,KpiFormulaError)
    assert failure.value.__cause__.row_indices==(3,)


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_absolute_percent_target_with_count_metric_gets_one_correction_and_preserves_supplied_job_data(monkeypatch, lang):
    configure(monkeypatch)
    metric = 'عدد الافتراضات الموثقة في السجل القابل للمراجعة' if lang == 'ar' else 'Number of documented assumptions'
    target = '100% من الافتراضات المستخدمة في التخطيط كهدف مقترح' if lang == 'ar' else 'Proposed: 100% of assumptions used in planning'
    corrected = ('(عدد الافتراضات الموثقة ÷ إجمالي الافتراضات المستخدمة في التخطيط) × 100' if lang == 'ar' else
                 '(Number of documented assumptions / Total eligible assumptions used in planning) × 100')
    bad = {**KPI, 'metric': metric, 'target': target}
    good = {**bad, 'metric': corrected}
    seen = provider(monkeypatch, None, responses=[{'kpis': [KPI, bad, KPI]}, {'kpis': [KPI, good, KPI]}])
    assert generate_kpis(CONTENT, lang) == [KPI, good, KPI]
    assert len(seen) == 2 and seen[0]['json']['contents'] == seen[1]['json']['contents']
    feedback = seen[1]['json']['systemInstruction']['parts'][0]['text']
    assert 'in rows 2.' in feedback and 'absolute percentage target/metric units' in feedback
    assert metric not in feedback and target not in feedback


def test_repeated_absolute_percent_target_with_count_metric_fails_after_one_correction(monkeypatch):
    configure(monkeypatch)
    bad = {**KPI, 'metric': 'Number of documented assumptions', 'target': '100% of planning assumptions'}
    seen = provider(monkeypatch, {'kpis': [KPI, bad, KPI]})
    with pytest.raises(ValueError, match='no results were fabricated') as failure:
        generate_kpis(CONTENT, 'en')
    assert len(seen) == 2 and isinstance(failure.value.__cause__, KpiFormulaError)
    assert failure.value.__cause__.row_indices == (2,)


def test_complete_worded_ratio_is_accepted_without_correction(monkeypatch):
    configure(monkeypatch)
    row={**KPI,'metric':'Percentage of quality models (eligible quality models divided by eligible reviewed models) multiplied by 100',
         'target':'Proposed: 90%'}
    seen=provider(monkeypatch,{'kpis':[row]*3})
    assert generate_kpis(CONTENT,'en')==[row]*3
    assert len(seen)==1


@pytest.mark.parametrize('scenario,category,attempt,status', [
    ('formula', 'formula_validation', 2, '-'),
    ('schema', 'invalid_schema', 1, '-'),
    ('unfinished', 'unfinished_generation', 1, '-'),
    ('json', 'invalid_json', 1, '-'),
    ('shape', 'invalid_schema', 1, '-'),
    ('http', 'provider_http', 1, '429'),
    ('transport', 'provider_transport', 1, '-'),
])
def test_terminal_generation_diagnostics_emit_only_allowlisted_categories_and_bounded_numbers(monkeypatch, caplog, scenario, category, attempt, status):
    import server.performance as module
    configure(monkeypatch)
    provider(monkeypatch, None)
    calls = []

    class Response:
        content = b'{}'
        status_code = 200

        def raise_for_status(self):
            if scenario == 'http':
                response = module.httpx.Response(429)
                raise module.httpx.HTTPStatusError('PRIVATE_EXCEPTION_SECRET', request=module.httpx.Request('POST', 'https://synthetic.example.test'), response=response)

        def json(self):
            if scenario == 'shape':
                return {'candidates': []}
            bad = {**KPI, 'outcome': 'PRIVATE_PROVIDER_OUTPUT_SECRET', 'metric': 'Number of documented assumptions', 'target': '100%'}
            rows = [KPI, bad, KPI] if scenario == 'formula' else [KPI] * 3
            payload = {'kpis': [{**KPI, 'target': 20}] * 3} if scenario == 'schema' else {'kpis': rows}
            text = 'PRIVATE_PROVIDER_OUTPUT_SECRET invalid JSON' if scenario == 'json' else json.dumps(payload)
            return {'candidates': [{'finishReason': 'MAX_TOKENS' if scenario == 'unfinished' else 'STOP', 'content': {'parts': [{'text': text}]}}]}

    def post(*args, **kwargs):
        calls.append(True)
        if scenario == 'transport':
            raise module.httpx.ReadTimeout('PRIVATE_EXCEPTION_SECRET')
        return Response()

    monkeypatch.setattr(module, 'provider_post', post)
    with caplog.at_level(logging.WARNING, logger='miyar.kpi'):
        with pytest.raises(ValueError, match='no results were fabricated'):
            generate_kpis({**CONTENT, 'successMeasures': 'PRIVATE_INPUT_SECRET'}, 'en')
    records = [record for record in caplog.records if record.name == 'miyar.kpi']
    assert len(records) == 1 and len(calls) == attempt
    message = records[0].getMessage()
    assert 'category=' + category in message and 'attempt=' + str(attempt) in message
    assert 'upstream_status=' + status in message
    assert 'formula_rows=' + ('2' if scenario == 'formula' else '-') in message
    assert all(secret not in caplog.text for secret in ['PRIVATE_INPUT_SECRET', 'PRIVATE_PROVIDER_OUTPUT_SECRET', 'PRIVATE_EXCEPTION_SECRET', 'private-synthetic-test-key'])
