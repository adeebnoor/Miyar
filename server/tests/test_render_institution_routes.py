from fastapi.testclient import TestClient


def test_institution_profile_routes_are_reachable_when_server_hosts_ui(tmp_path, monkeypatch):
    monkeypatch.setenv('MIYAR_SERVE_UI', 'true')
    monkeypatch.delenv('MIYAR_ENV', raising=False)
    monkeypatch.setenv('MIYAR_JWT_SECRET', 'deployment-test-secret-not-for-production-1234')

    from server.app import create_app
    app = create_app('sqlite:///' + str(tmp_path / 'ui.db'), 'deployment-test-secret-not-for-production-1234')

    with TestClient(app) as client:
        # 401 proves the API route is reached. 404/405 would mean the static mount shadowed it.
        assert client.get('/api/v1/settings/institution-profile').status_code == 401
        assert client.post('/api/v1/settings/institution-profile', json={}).status_code == 401
        page = client.get('/')
        assert page.status_code == 200
        assert './config.js' in page.text
