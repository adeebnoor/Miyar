"""Operator-enabled live provider check using fixed, non-organizational examples.

No HTTP request can start this check. It never creates accounts or reads the DB.
Enable MIYAR_STRATEGIC_STARTUP_CHECK=true for a diagnostic deployment, then
disable it to avoid repeating provider calls on later restarts.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx

from .strategic import CORPUS, StrategicEngine, capability

REPORT = Path('.runtime/strategic-provider-check.json')


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def safe_failure(error):
    """Return allowlisted diagnostics, never URLs, headers or provider messages."""
    current = error
    for _ in range(5):
        if isinstance(current, httpx.HTTPStatusError):
            result = {'kind': 'provider-http-error', 'httpStatus': current.response.status_code}
            try:
                payload = current.response.json().get('error', {})
                status = payload.get('status')
                if status in {'INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED',
                              'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'INTERNAL'}:
                    result['providerStatus'] = status
                allowed = {'API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED',
                           'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED',
                           'SERVICE_DISABLED', 'BILLING_DISABLED'}
                reasons = [x.get('reason') for x in payload.get('details', []) if isinstance(x, dict)]
                result['reasons'] = [x for x in reasons if x in allowed]
            except (ValueError, TypeError, AttributeError):
                pass
            return result
        if isinstance(current, httpx.TimeoutException):
            return {'kind': 'provider-timeout'}
        current = current.__cause__
        if current is None:
            break
    return {'kind': 'pipeline-error'}


def run_check(engine=None, occupations=None):
    caps = capability()
    report = {'scope': 'fixed-example-provider-check-not-user-login-or-accuracy-evaluation',
              'startedAt': timestamp(), 'status': 'running', 'cases': [],
              'embeddingModel': caps['embeddingModel'], 'generationModel': caps['generationModel']}
    if not caps['configured']:
        return {**report, 'status': 'failed', 'error': {'kind': 'not-configured'}, 'finishedAt': timestamp()}
    engine = engine or StrategicEngine()
    if occupations is None:
        from .taxonomy import Catalog
        occupations = Catalog().occupations['nodes']
    civil = next(r for r in json.loads(CORPUS.read_text())['roles'] if r['ssco'] == '214201')
    examples = [
        ('original-civil-objective', {'text': civil['objective'], 'field': 'Engineering',
         'seniority': 'Professional', 'constraints': 'Individual contributor; no management responsibilities.'},
         'matched-objective'),
        ('arabic-payroll-objective', {'text': 'رفع دقة احتساب الرواتب والاستقطاعات ومراجعة مسيرات الأجور وتسوية فروقات الرواتب وإعداد تقارير شهرية لمدير المالية دون إدارة فريق.',
         'field': 'الموارد البشرية والرواتب', 'seniority': 'أخصائي',
         'constraints': 'دور تخصصي فردي وليس مديرًا. لا تخترع رمزًا مهنيًا رسميًا.'},
         'generated-proposal')]
    for name, context, expected_route in examples:
        case = {'name': name, 'input': context, 'expectedRoute': expected_route}
        try:
            result = engine.analyze(context, occupations, float(os.getenv('MIYAR_STRATEGIC_THRESHOLD', '.85')))
            case['result'] = {k: result[k] for k in ['route', 'cosineSimilarity', 'threshold',
                'finalTitle', 'status', 'occupationCode', 'educationCode', 'classificationStatus', 'noveltyEstablished']}
            checks = {'expectedRoute': result['route'] == expected_route,
                      'usableTitle': bool(result['finalTitle']) and result['status'] == 'human-review-required',
                      'noNoveltyClaim': result['noveltyEstablished'] is False}
            if expected_route == 'matched-objective':
                checks['sourceCode'] = result['occupationCode'] == '214201'
            else:
                checks['noInventedCode'] = result['occupationCode'] is None and result['educationCode'] is None
            case.update(checks=checks, passed=all(checks.values()))
        except Exception as error:
            case.update(passed=False, error=safe_failure(error))
            report['cases'].append(case)
            break
        report['cases'].append(case)
    report.update(status='passed' if len(report['cases']) == 2 and all(c['passed'] for c in report['cases']) else 'failed', finishedAt=timestamp())
    return report


def save_report(report):
    REPORT.parent.mkdir(exist_ok=True)
    temporary = REPORT.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False))
    temporary.replace(REPORT)


def public_report():
    if os.getenv('MIYAR_STRATEGIC_STARTUP_CHECK') != 'true':
        return {}
    try:
        report = json.loads(REPORT.read_text())
        return {'providerSelfTest': report}
    except (OSError, ValueError):
        return {'providerSelfTest': {'status': 'pending'}}


if __name__ == '__main__':
    save_report({'status': 'running', 'startedAt': timestamp()})
    report = run_check()
    save_report(report)
    print(json.dumps({'strategicProviderCheck': report}, ensure_ascii=False), flush=True)
