from server.governed import route
from server.taxonomy import Catalog


def test_adjacent_mapping_cannot_pass_source_gate_or_approved_fallback():
    catalog = Catalog()
    adjacent = {'code': '242114', 'cosineSimilarity': .98,
                'mappingStatus': 'adjacent-reference-for-review'}
    second = {'code': '242109', 'cosineSimilarity': .8,
              'mappingStatus': 'adjacent-reference-for-review'}
    result = route([adjacent, second], catalog, {'242114'},
                   fallback_candidates=[adjacent])
    assert result['statisticalGatePassed'] is True
    assert result['route'] == 'provisional_required'
    assert result['selected'] is None
    assert next(row for row in result['rules'] if row['id'] == 'R05')['pass'] is False
    assert result['humanApprovalRequired'] is True


def test_verified_source_title_can_still_pass_ordinary_review_gate():
    catalog = Catalog()
    candidates = [
        {'code': '241105', 'cosineSimilarity': .95,
         'mappingStatus': 'source-title-reference-for-review'},
        {'code': '241102', 'cosineSimilarity': .8,
         'mappingStatus': 'source-title-reference-for-review'},
    ]
    result = route(candidates, catalog, set())
    assert result['route'] == 'candidate_for_review'
    assert result['selected']['code'] == '241105'
    assert result['nationalCodeReleaseAllowed'] is False
