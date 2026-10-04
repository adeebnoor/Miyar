"""Compound job measures and bounded repair of typed Gemini KPI drafts."""

import copy
import json
import logging

import pytest

from server.performance import KpiFormulaError, complete_percentage_formula, generate_kpis


PUBLIC_FIELDS = {'outcome', 'metric', 'target', 'frequency', 'deliverable'}


def planning_case(lang):
    if lang == 'ar':
        content = {
            'title': 'أخصائي تخطيط قوى عاملة — مثال اصطناعي',
            'field': 'الموارد البشرية',
            'successMeasures': 'إنجاز خطة القوى العاملة المعتمدة في غضون 30 يومًا، وتحقيق اكتمال بيانات الوظائف بنسبة 95% شهريًا، وتوثيق الفجوات والافتراضات في سجل قابل للمراجعة.',
            'responsibilities': 'تحليل الطلب والعرض ومراجعة فجوات المهارات وإعداد سيناريوهات العدد والتكلفة.',
            'purpose': 'مثال اصطناعي للتحقق من الخدمة فقط.',
        }
        rows = [
            {
                'outcome': 'إنجاز خطة القوى العاملة المعتمدة في المهلة',
                'metric': {'kind': 'direct', 'label': 'عدد الأيام لإنجاز الخطة المعتمدة؛ بداية المهلة تحتاج تحديدًا مع المدير', 'numerator': '', 'denominator': ''},
                'target': 'خلال 30 يومًا؛ بداية المهلة تحتاج تحديدًا',
                'frequency': 'لكل دورة تخطيط — مقترح للمراجعة',
                'deliverable': 'الخطة المعتمدة وسجل تواريخ إعدادها واعتمادها',
            },
            {
                'outcome': 'اكتمال بيانات الوظائف شهريًا',
                'metric': {'kind': 'percentage', 'label': 'نسبة اكتمال بيانات الوظائف', 'numerator': 'عدد سجلات الوظائف المكتملة في نطاق الخطة خلال الشهر', 'denominator': 'إجمالي سجلات الوظائف في نطاق الخطة خلال الشهر، بما فيها غير المكتملة'},
                'target': '95% شهريًا',
                'frequency': 'شهريًا',
                'deliverable': 'قائمة تحقق اكتمال بيانات الوظائف وسجل المراجعة الشهري',
            },
            {
                'outcome': 'توثيق الفجوات والافتراضات في سجل قابل للمراجعة',
                'metric': {'kind': 'percentage', 'label': 'تغطية توثيق الفجوات والافتراضات — تعريف مقترح', 'numerator': 'عدد الفجوات والافتراضات المحددة في دورة التخطيط والموثقة في السجل القابل للمراجعة', 'denominator': 'إجمالي الفجوات والافتراضات المحددة في دورة التخطيط نفسها'},
                'target': 'مقترح: توثيق 100% من الفجوات والافتراضات المحددة؛ يحتاج مراجعة المدير',
                'frequency': 'لكل دورة تخطيط — مقترح للمراجعة',
                'deliverable': 'سجل الفجوات والافتراضات مع الأدلة ومراجع النسخ',
            },
        ]
    else:
        content = {
            'title': 'Workforce Planning Specialist — synthetic example',
            'field': 'Human Resources',
            'successMeasures': 'Complete the approved workforce plan within 30 days, achieve 95% monthly job-data completeness, and document gaps and assumptions in an auditable register.',
            'responsibilities': 'Analyze demand and supply, review skill gaps, and prepare headcount and cost scenarios.',
            'purpose': 'Synthetic service-verification example only.',
        }
        rows = [
            {
                'outcome': 'Complete the approved workforce plan within the deadline',
                'metric': {'kind': 'direct', 'label': 'Elapsed days to complete the approved plan; clock start needs manager definition', 'numerator': '', 'denominator': ''},
                'target': 'Within 30 days; clock start needs definition',
                'frequency': 'Per planning cycle — proposed for review',
                'deliverable': 'Approved plan and timestamped preparation and approval record',
            },
            {
                'outcome': 'Achieve monthly job-data completeness',
                'metric': {'kind': 'percentage', 'label': 'Job-data completeness percentage', 'numerator': 'Complete job records in the plan scope during the month', 'denominator': 'All job records in the plan scope during the same month, including incomplete records'},
                'target': '95% monthly',
                'frequency': 'Monthly',
                'deliverable': 'Job-data completeness checklist and monthly review record',
            },
            {
                'outcome': 'Document gaps AND assumptions in an auditable register',
                'metric': {'kind': 'percentage', 'label': 'Gap AND assumption documentation coverage — proposed definition', 'numerator': 'Identified gaps AND assumptions from the planning cycle documented in the auditable register', 'denominator': 'All identified gaps AND assumptions from the same planning cycle'},
                'target': 'Proposed: document 100% of identified gaps AND assumptions; requires manager review',
                'frequency': 'Per planning cycle — proposed for review',
                'deliverable': 'Gap AND assumption register with evidence and version references',
            },
        ]
    return content, rows


def mock_provider(monkeypatch, responses):
    """Intercept the provider transport; these tests cannot reach Gemini."""
    import server.performance as module

    monkeypatch.setenv('MIYAR_KPI_PROVIDER', 'gemini')
    monkeypatch.setenv('MIYAR_KPI_MODEL', 'gemini-3.1-flash-lite')
    monkeypatch.setenv('MIYAR_STRATEGIC_GEMINI_KEY', 'private-synthetic-complex-test-key')
    calls = []

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, *args, **kwargs):
            raise AssertionError('Unmocked provider transport must not run')

    class Response:
        content = b'{}'
        status_code = 200

        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            pass

        def json(self):
            return {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [
                {'text': 'PRIVATE_THOUGHT_NOT_FOR_REPAIR_OR_OUTPUT', 'thought': True},
                {'text': json.dumps(self.payload, ensure_ascii=False)},
            ]}}]}

    def post(client, url, **kwargs):
        calls.append(copy.deepcopy(kwargs))
        payload = responses[min(len(calls) - 1, len(responses) - 1)]
        return Response(payload)

    monkeypatch.setattr(module.httpx, 'Client', Client)
    monkeypatch.setattr(module, 'provider_post', post)
    return calls


def assert_public_rows(result, draft):
    assert len(result) == len(draft) == 3
    for actual, proposed in zip(result, draft):
        assert set(actual) == PUBLIC_FIELDS
        assert all(isinstance(value, str) and value.strip() for value in actual.values())
        assert {key: actual[key] for key in PUBLIC_FIELDS - {'metric'}} == {
            key: proposed[key] for key in PUBLIC_FIELDS - {'metric'}
        }
        metric = proposed['metric']
        assert metric['label'] in actual['metric']
        if metric['kind'] == 'percentage':
            assert metric['numerator'] in actual['metric']
            assert metric['denominator'] in actual['metric']
            assert complete_percentage_formula(actual['metric'])
        else:
            assert actual['metric'] == metric['label']


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_compound_planning_targets_and_both_documentation_requirements_survive_typed_rendering(monkeypatch, lang):
    content, rows = planning_case(lang)
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    result = generate_kpis(content, lang)

    assert_public_rows(result, rows)
    assert len(calls) == 1
    assert '30' in result[0]['target'] and '%' not in result[0]['metric']
    assert '95%' in result[1]['target']
    assert result[1]['frequency'] == ('شهريًا' if lang == 'ar' else 'Monthly')
    assert ('مقترح' if lang == 'ar' else 'Proposed') in result[2]['target']
    for term in (('الفجوات', 'الافتراضات') if lang == 'ar' else ('gaps', 'assumptions')):
        assert term in result[2]['outcome'] and term in result[2]['metric']
    request_data = json.loads(calls[0]['json']['contents'][0]['parts'][0]['text'])
    for key, value in content.items():
        assert request_data[key] == value


@pytest.mark.parametrize('lang', ['ar', 'en'])
@pytest.mark.parametrize('missing_operand', ['numerator', 'denominator'])
def test_missing_percentage_operand_is_never_inferred_after_the_bounded_correction(monkeypatch, lang, missing_operand):
    content, rows = planning_case(lang)
    rows[2]['metric'][missing_operand] = '   '
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    with pytest.raises(ValueError, match='no results were fabricated') as failure:
        generate_kpis(content, lang)

    assert len(calls) == 2
    assert isinstance(failure.value.__cause__, KpiFormulaError)
    assert failure.value.__cause__.row_indices == (3,)


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_count_with_absolute_percentage_gets_one_contextual_repair_without_promoting_draft_to_system(monkeypatch, lang):
    content, corrected = planning_case(lang)
    bad = copy.deepcopy(corrected)
    marker = 'UNTRUSTED_PROVIDER_DRAFT_MARKER'
    bad[2]['metric'] = {
        'kind': 'direct',
        'label': ('عدد الفجوات والافتراضات الموثقة ' if lang == 'ar' else 'Count of documented gaps AND assumptions ') + marker,
        'numerator': '',
        'denominator': '',
    }
    calls = mock_provider(monkeypatch, [{'kpis': bad}, {'kpis': corrected}])

    result = generate_kpis(content, lang)

    assert_public_rows(result, corrected)
    assert len(calls) == 2
    first, second = [call['json'] for call in calls]
    assert first['systemInstruction'] == second['systemInstruction']
    assert first['generationConfig'] == second['generationConfig']
    assert second['contents'][0] == first['contents'][0]
    assert [message['role'] for message in second['contents']] == ['user', 'model', 'user']
    assert json.loads(second['contents'][1]['parts'][0]['text']) == {'kpis': bad}
    feedback = second['contents'][2]['parts'][0]['text']
    assert 'in rows 3.' in feedback and 'Server validation feedback' in feedback
    assert marker not in json.dumps(second['systemInstruction']) and marker not in feedback
    assert 'PRIVATE_THOUGHT_NOT_FOR_REPAIR_OR_OUTPUT' not in json.dumps(second)
    assert marker not in json.dumps(result)


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_repeated_count_percentage_mismatch_withholds_all_rows_and_logs_no_job_or_draft_text(monkeypatch, caplog, lang):
    content, rows = planning_case(lang)
    content['purpose'] = 'PRIVATE_COMPOUND_JOB_INPUT'
    rows[2]['metric'] = {
        'kind': 'direct',
        'label': ('عدد الفجوات والافتراضات الموثقة ' if lang == 'ar' else 'Count of documented gaps AND assumptions ') + 'PRIVATE_COMPOUND_PROVIDER_OUTPUT',
        'numerator': '',
        'denominator': '',
    }
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    with caplog.at_level(logging.WARNING, logger='miyar.kpi'):
        with pytest.raises(ValueError, match='no results were fabricated') as failure:
            generate_kpis(content, lang)

    assert len(calls) == 2
    assert isinstance(failure.value.__cause__, KpiFormulaError)
    assert failure.value.__cause__.row_indices == (3,)
    records = [record for record in caplog.records if record.name == 'miyar.kpi']
    assert len(records) == 1 and 'attempt=2' in records[0].getMessage()
    for secret in ('PRIVATE_COMPOUND_JOB_INPUT', 'PRIVATE_COMPOUND_PROVIDER_OUTPUT', 'private-synthetic-complex-test-key'):
        assert secret not in caplog.text


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_direct_measurement_cannot_hide_ratio_operands(monkeypatch, lang):
    content, rows = planning_case(lang)
    rows[0]['metric']['numerator'] = 'Unrequested hidden operand'
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    with pytest.raises(ValueError, match='no results were fabricated'):
        generate_kpis(content, lang)

    assert len(calls) == 1


@pytest.mark.parametrize('lang', ['ar', 'en'])
@pytest.mark.parametrize('defect', ['extra_division', 'unbalanced_operand'])
def test_typed_percentage_cannot_bypass_formula_checks_without_textual_percentage_markers(monkeypatch, lang, defect):
    content, rows = planning_case(lang)
    rows[2]['metric']['label'] = 'التغطية' if lang == 'ar' else 'Coverage'
    rows[2]['target'] = 'مقترح: 95' if lang == 'ar' else 'Proposed: 95'
    if defect == 'extra_division':
        rows[2]['metric']['denominator'] = (
            'إجمالي الفجوات والافتراضات المؤهلة / إجمالي الموظفين'
            if lang == 'ar' else 'All eligible gaps AND assumptions / all employees'
        )
    else:
        rows[2]['metric']['numerator'] = (
            'الفجوات والافتراضات الموثقة (المؤهلة'
            if lang == 'ar' else 'Documented gaps AND assumptions (eligible'
        )
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    with pytest.raises(ValueError, match='no results were fabricated') as failure:
        generate_kpis(content, lang)

    assert len(calls) == 2
    cause = failure.value.__cause__
    assert isinstance(cause, KpiFormulaError) and cause.row_indices == (3,)
    counts = cause.syntax_counts[3]
    assert counts['divisions'] == (2 if defect == 'extra_division' else 1)
    assert counts['exactScales'] == 1
    if defect == 'unbalanced_operand':
        assert counts['openParentheses'] != counts['closeParentheses']


@pytest.mark.parametrize('lang', ['ar', 'en'])
def test_raw_typed_label_cannot_evade_length_limit_through_trailing_whitespace(monkeypatch, lang):
    content, rows = planning_case(lang)
    label = 'التغطية' if lang == 'ar' else 'Coverage'
    rows[2]['metric']['label'] = label + ' ' * (1501 - len(label))
    rows[2]['target'] = 'مقترح: 95' if lang == 'ar' else 'Proposed: 95'
    assert len(rows[2]['metric']['label']) == 1501
    calls = mock_provider(monkeypatch, [{'kpis': rows}])

    with pytest.raises(ValueError, match='no results were fabricated'):
        generate_kpis(content, lang)

    assert len(calls) == 1
