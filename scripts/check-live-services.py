"""Verify public service responses with synthetic data before publishing the UI.

No organization records, credentials or employee data are read or written.
The public PDF endpoint renders a draft in memory; it does not save a position.
"""
import json,time
import urllib.error
import urllib.request

BASE = 'https://miyar-enterprise-api.onrender.com'


def request(path, payload=None):
    body = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(BASE + path, data=body,
                                 headers={'Content-Type': 'application/json'} if body else {})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.headers, response.read()


def main():
    statuses = {}
    for name, path in [('health', '/health'),
                       ('strategic', '/api/v1/analyze/strategic/status'),
                       ('trial', '/api/v1/review/strategic/status')]:
        _, body = request(path)
        statuses[name] = json.loads(body)
    assert statuses['health']['status'] == 'ok', 'API health failed'
    assert isinstance(statuses['strategic']['configured'], bool)
    assert isinstance(statuses['trial']['enabled'], bool)
    assert 'remainingToday' in statuses['trial']
    for attempt in range(60):
        services=statuses['health']['services']
        assert services.get('semanticEnabled') and services.get('kpiGenerationEnabled'), 'Requested HR AI services are not configured'
        semantic=services.get('skillsSemantic',{})
        if semantic.get('modelReady'):break
        assert semantic.get('indexStatus')!='failed', 'Semantic index initialization failed: '+str(semantic.get('lastFailure'))
        if attempt==59:raise AssertionError('Semantic index did not become ready within five minutes')
        time.sleep(5)
        _,body=request('/health');statuses['health']=json.loads(body)
    print('Live semantic index verified:',semantic.get('indexedDocuments'),'documents; KPI provider:',services.get('kpiGeneration',{}).get('provider'))
    for path in ['/api/v1/positions', '/api/v1/capabilities', '/api/v1/settings/institution-profile']:
        try:
            request(path)
        except urllib.error.HTTPError as error:
            assert error.code == 401, 'Unexpected protected-service response: ' + path
        else:
            raise AssertionError('Protected service accepted anonymous access: ' + path)
    headers, pdf = request('/api/v1/public/position-pdf', {
        'lang': 'en',
        'content': {
            'title': 'Synthetic release verification role',
            'purpose': 'Verify the public drafting export with synthetic data only.',
            'responsibilities': 'Prepare test records\nCheck document output\nDocument verification results',
            'businessNeed': 'Synthetic release verification; not a workforce request.',
            'headcount': 1,
        },
    })
    assert headers.get_content_type() == 'application/pdf', 'Wrong PDF response content type'
    assert pdf.startswith(b'%PDF-') and len(pdf) > 1000, 'Public PDF is missing or malformed'
    assert headers.get('Cache-Control') == 'no-store', 'Draft export must not be cached'
    print('Live public PDF verified:', len(pdf), 'bytes')
    print('Live protected services verified: anonymous access rejected')
    print('Observed optional capabilities:', json.dumps({
        'strategicAIConfigured': statuses['strategic']['configured'],
        'expertTrialOpen': statuses['trial']['enabled'],
        'semanticSkillsEnabled': statuses['health']['services'].get('semanticEnabled', False),
        'serverKPIGenerationEnabled': statuses['health']['services'].get('kpiGenerationEnabled', False),
    }))


if __name__ == '__main__':
    main()
