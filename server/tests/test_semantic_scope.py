"""Scope safeguards using current source references and independent vector math."""
import copy
import json

import numpy as np
import pytest

from server.semantic_scope import OccupationScope, read_role_catalog
from server.taxonomy import Catalog


@pytest.fixture
def catalog():
    return Catalog()


def test_existing_authored_catalog_is_json_and_all_references_match_selected_source(catalog):
    payload = read_role_catalog()
    assert len(payload['families']) == 20 and len(payload['roles']) == 89
    for role in payload['roles']:
        source = catalog.nodes[role['ssco']]
        assert source['level'] == 'occupation'
        assert source['titleAr'] == role['referenceTitleAr']
        assert source['sourcePage'] == role['sourcePage']


@pytest.mark.parametrize('field', ['', 'Unrecognized department', 'investmentish', 'auditorium',
                                    'without investment', 'not responsible for internal audit',
                                    'دون الموارد البشرية', 'بدون الاستثمار', 'غير الاستثمار',
                                    'لا أعمل في الموارد البشرية', 'ليست المراجعة الداخلية'])
def test_missing_unknown_negative_and_partial_words_do_not_propose_an_occupation(catalog, field):
    scope = OccupationScope(field, 'Specialist', catalog.nodes)
    assert scope.references == {} and scope.families == []
    assert scope.metadata(0)['status'] == 'insufficient-evidence'


def test_explicit_mixed_field_preserves_both_families_but_not_excluded_finance(catalog):
    scope = OccupationScope('Investment and Internal Audit, not Finance', 'Specialist', catalog.nodes)
    assert scope.families == ['investment', 'internalAudit']
    assert set(scope.references) == {'241308', '241321'}
    assert '241314' not in scope.references


def test_arabic_field_articles_and_conjunctions_and_english_word_boundaries(catalog):
    scope = OccupationScope('المراجعة الداخلية والاستثمار', 'أخصائي فردي', catalog.nodes)
    assert set(scope.families) == {'internalAudit', 'investment'}
    assert set(scope.references) == {'241308', '241321'}
    assert OccupationScope('audit investmentish information technologies', '', catalog.nodes).families == []
    assert OccupationScope('الاستثمار مثلا', 'أخصائي', catalog.nodes).families == ['investment']


@pytest.mark.parametrize('seniority', ['Specialist individual contributor', 'أخصائي فردي', 'اختصاصي', 'Analyst'])
def test_explicit_specialist_level_excludes_management_references(catalog, seniority):
    scope = OccupationScope('Investment', seniority, catalog.nodes)
    assert set(scope.references) == {'241308'}
    assert scope.metadata(1)['requestedLevel'] == 'specialist'


@pytest.mark.parametrize('seniority', ['', 'Unrecognized level', 'Manager', 'Manager and Specialist',
                                       'non-specialist', 'specialist / team lead', 'أخصائي / مديرة'])
def test_missing_unknown_or_conflicting_level_does_not_invent_specialist_scope(catalog, seniority):
    scope = OccupationScope('Investment', seniority, catalog.nodes)
    assert set(scope.references) == {'241308', '121110'}
    assert scope.metadata(2)['requestedLevel'] is None


def test_hr_workforce_and_skill_aliases_constrain_intent_from_field_only(catalog):
    scope = OccupationScope('الموارد البشرية وتخطيط القوى العاملة والمهارات', 'أخصائي', catalog.nodes)
    assert scope.families == ['hc']
    assert scope.intents == {'hc': {'workforce'}}
    assert set(scope.references) == {'242303', '242319'}
    assert '242322' not in scope.references  # Payroll cannot be borrowed from narrative.
    assert '242402' not in scope.references  # Training is not silently equated to skill analysis.
    aliases = OccupationScope('Skills gap analysis', 'Specialist', catalog.nodes)
    assert set(aliases.references) == {'242303', '242319'}


def test_hr_operations_long_phrase_does_not_also_anchor_other_operations_family(catalog):
    scope = OccupationScope('HR operations', 'Specialist', catalog.nodes)
    assert scope.families == ['hc'] and set(scope.references) == {'242303'}


@pytest.mark.parametrize('field', ['training', 'candidate', 'shared services', 'الخدمات المشتركة',
                                  'internal audit training', 'software training'])
def test_generic_training_or_shared_service_words_do_not_create_hr_field_scope(catalog, field):
    scope = OccupationScope(field, 'Specialist', catalog.nodes)
    assert 'hc' not in scope.families


@pytest.mark.parametrize('damage', ['code', 'title', 'page', 'parent', 'flagged'])
def test_changed_or_missing_source_reference_fails_closed(catalog, damage):
    nodes = copy.deepcopy(catalog.nodes)
    flagged = set()
    if damage == 'code':
        del nodes['241308']
    elif damage == 'title':
        nodes['241308']['titleAr'] = 'Different source title'
    elif damage == 'page':
        nodes['241308']['sourcePage'] += 1
    elif damage == 'parent':
        del nodes[nodes['241308']['parent']]
    else:
        flagged.add('241308')
    scope = OccupationScope('Investment', 'Specialist', nodes, flagged)
    assert scope.references == {}


def test_adjacent_project_and_pmo_references_are_explicit_and_source_titles_are_preserved(catalog):
    scope = OccupationScope('Project development and project management office', 'Specialist', catalog.nodes)
    assert set(scope.references) == {'242114'}
    assert scope.references['242114']['mappingStatus'] == 'adjacent-reference-for-review'
    assert catalog.nodes['242114']['titleAr'] == 'محلل أعمال'
    assert OccupationScope('Corporate strategy', 'Specialist', catalog.nodes).references['242204']['mappingStatus'] == 'source-title-reference-for-review'


def prepared_semantic(monkeypatch, catalog, scores, skills=None):
    monkeypatch.setenv('MIYAR_ENABLE_EMBEDDINGS', 'true')
    monkeypatch.setenv('MIYAR_EMBEDDING_PROVIDER', 'local-e5-small')
    monkeypatch.setenv('MIYAR_SEMANTIC_SKILL_THRESHOLD', '.8')
    seen = []

    class Model:
        def embed(self, texts):
            seen.extend(texts)
            return iter([[1., 0.]])

        def query_metadata(self, text):
            return {'queryChunks': 1, 'queryPooling': 'weighted-token-mean-l2'}

    catalog.model = Model()
    catalog.model_name = 'intfloat/multilingual-e5-small'
    catalog.model_fingerprint = 'scope-test-independent-vectors'
    catalog.vector_roles = list(catalog.roles.values())
    catalog.matrix = np.array([[scores.get(role['code'], .2), np.sqrt(1 - scores.get(role['code'], .2) ** 2)]
                               for role in catalog.vector_roles], dtype=np.float32)
    if skills:
        catalog.skills = [skill for skill in catalog.skills if skill['id'] in skills]
        catalog.skill_matrix = np.array([[skills[skill['id']], np.sqrt(1 - skills[skill['id']] ** 2)]
                                        for skill in catalog.skills], dtype=np.float32)
    else:
        catalog.skill_matrix = None
    return seen


def test_real_cosines_are_filtered_without_blending_rescoring_or_forced_padding(monkeypatch, catalog):
    prepared_semantic(monkeypatch, catalog, {'241207': .99, '241308': .71, '121110': .95})
    result = catalog.semantic('Investment analyst; reports to warehouse management.', field='Investment', seniority='Specialist')
    assert [candidate['code'] for candidate in result['candidates']] == ['241308']
    candidate = result['candidates'][0]
    assert candidate['cosineSimilarity'] == .71 and candidate['semanticDistance'] == .29
    assert candidate['titleAr'] == catalog.nodes['241308']['titleAr']
    assert candidate['mappingStatus'] == 'source-title-reference-for-review'
    assert result['occupationScope']['candidateCount'] == 1
    assert result['modelFingerprint'] == 'scope-test-independent-vectors'


def test_approved_candidate_restriction_intersects_scope_without_cross_domain_fallback(monkeypatch, catalog):
    prepared_semantic(monkeypatch, catalog, {'241207': .99, '241308': .71})
    result = catalog.semantic('Investment work', candidate_codes={'241207'}, field='Investment', seniority='Specialist')
    assert result['candidates'] == [] and result['occupationScope']['candidateCount'] == 0
    accepted = catalog.semantic('Investment work', candidate_codes={'241207', '241308'}, field='Investment', seniority='Specialist')
    assert [candidate['code'] for candidate in accepted['candidates']] == ['241308']


def test_unknown_field_still_embeds_full_text_and_returns_generic_semantic_skills(monkeypatch, catalog):
    seen = prepared_semantic(monkeypatch, catalog, {'241308': .99}, {'onet:2.B.1.b': .85, 'miyar:audit-planning': .98})
    text = 'A complete complex sentence; investment is merely a recipient, not the entered field.'
    result = catalog.semantic(text)
    assert seen == [text] and result['queryChunks'] == 1
    assert result['candidates'] == [] and result['occupationScope']['status'] == 'insufficient-evidence'
    assert [skill['id'] for skill in result['semanticSkills']] == ['onet:2.B.1.b']


def test_domain_skill_filter_preserves_direct_dictionary_evidence_and_true_cosine(monkeypatch, catalog):
    scores = {'miyar:audit-planning': .99, 'miyar:project-governance': .97,
              'miyar:strategic-planning': .91, 'onet:2.B.1.b': .85}
    prepared_semantic(monkeypatch, catalog, {'242303': .9}, scores)
    result = catalog.semantic('HR workforce analysis and coordination', field='Human Resources', seniority='Specialist')
    assert {skill['id'] for skill in result['semanticSkills']} == {'miyar:strategic-planning', 'onet:2.B.1.b'}
    assert next(skill for skill in result['semanticSkills'] if skill['id'] == 'miyar:strategic-planning')['cosineSimilarity'] == .91
    explicit = catalog.semantic('Review audit plan and workforce analysis', field='Human Resources', seniority='Specialist')
    audit = next(skill for skill in explicit['semanticSkills'] if skill['id'] == 'miyar:audit-planning')
    assert audit['scopeEvidence'] == 'dictionary-supported' and audit['cosineSimilarity'] == .99
    assert any(skill['id'] == 'miyar:audit-planning' and skill['method'] == 'dictionary-extraction' for skill in explicit['extractedSkills'])
    assert all(skill['humanReviewRequired'] for skill in explicit['semanticSkills'])


def test_hr_workforce_observed_false_skill_candidates_are_suppressed_without_refilling(monkeypatch, catalog):
    # Actual observed ordering from the Arabic qualitative case; no accuracy
    # assertion is made about these synthetic vector values or this skill list.
    scores = {'miyar:audit-planning': .84301, 'miyar:strategic-planning': .84219,
              'miyar:benefits-tracking': .83878, 'miyar:project-governance': .83421,
              'onet:2.B.1.b': .83318, 'onet:2.A.1.c': .83288, 'onet:2.B.3.e': .82581}
    prepared_semantic(monkeypatch, catalog, {'242322': .88601, '242319': .87469, '242303': .86857}, scores)
    text = ('أخصائي تخطيط القوى العاملة وتحليل المهارات يحلل الطلب والعرض وفجوات القدرات '
            'ويقارن بدائل التدريب والتوظيف، ويراجع التكلفة مع فريق الرواتب دون اعتماد الأجور.')
    result = catalog.semantic(text, field='الموارد البشرية وتخطيط القوى العاملة والمهارات', seniority='أخصائي فردي')
    assert [candidate['code'] for candidate in result['candidates']] == ['242319', '242303']
    assert {skill['id'] for skill in result['semanticSkills']} == {'miyar:strategic-planning', 'onet:2.B.1.b'}
    assert result['semanticSkillScope']['suppressedFromTopFive'] == 3
    assert 'onet:2.A.1.c' not in {skill['id'] for skill in result['semanticSkills']}  # No refill.
    assert not result['extractedSkills']  # Inferred skills never acquire authored evidence.


@pytest.mark.parametrize('skill_id', ['onet:2.B.3.e', 'onet:2.B.3.k', 'miyar:sql', 'miyar:python', 'miyar:ai'])
def test_technical_skills_need_field_support_or_explicit_dictionary_evidence(catalog, skill_id):
    scope = OccupationScope('Human Resources', 'Specialist', catalog.nodes)
    assert scope.skill_evidence(skill_id, set()) is None
    assert scope.skill_evidence(skill_id, {skill_id}) == 'dictionary-supported'
    assert OccupationScope('Information Technology', 'Specialist', catalog.nodes).skill_evidence(skill_id, set()) == 'explicit-field-family'
