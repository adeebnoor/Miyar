"""External reference checks keep transient failures distinct from access denials."""
import importlib.util
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock, patch


spec = importlib.util.spec_from_file_location(
    "miyar_external_links", Path(__file__).resolve().parents[2] / "scripts/check-external-links.py"
)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
URL = "https://official.example.test/reference"


def response():
    value = MagicMock()
    value.__enter__.return_value = value
    value.status = 200
    value.url = URL
    value.read.return_value = b"official reference"
    return value


def http_error(status):
    return urllib.error.HTTPError(URL, status, "test response", {}, None)


class ExternalReferenceContracts(unittest.TestCase):
    def test_timeout_retries_once_and_records_both_attempts(self):
        with patch.object(checker.urllib.request, "urlopen", side_effect=[TimeoutError(), response()]) as opener:
            result = checker.check(URL)
        self.assertEqual(opener.call_count, 2)
        self.assertEqual(result["result"], "reachable")
        self.assertEqual(result["attempts"][0]["reason"], "TimeoutError")
        self.assertEqual(result["attempts"][1]["status"], 200)
        self.assertTrue(all(call.kwargs["timeout"] == 30 for call in opener.call_args_list))

    def test_http_503_retries_once_without_changing_request(self):
        with patch.object(checker.urllib.request, "urlopen", side_effect=[http_error(503), response()]) as opener:
            result = checker.check(URL)
        self.assertEqual(opener.call_count, 2)
        self.assertEqual(result["attempts"][0]["status"], 503)
        self.assertEqual(result["attempts"][0]["reason"], "HTTPError")
        self.assertEqual(result["status"], 200)
        requests = [call.args[0] for call in opener.call_args_list]
        self.assertEqual(requests[0].full_url, requests[1].full_url)
        self.assertEqual(requests[0].headers, requests[1].headers)

    def test_http_403_is_not_retried_or_reported_as_working(self):
        with patch.object(checker.urllib.request, "urlopen", side_effect=http_error(403)) as opener:
            result = checker.check(URL)
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(result["result"], "not-confirmed")
        self.assertEqual(result["status"], 403)
        self.assertEqual(len(result["attempts"]), 1)

    def test_missing_and_gone_references_are_broken_without_retry(self):
        for status in [404, 410]:
            with self.subTest(status=status):
                with patch.object(checker.urllib.request, "urlopen", side_effect=http_error(status)) as opener:
                    result = checker.check(URL)
                self.assertEqual(opener.call_count, 1)
                self.assertEqual(result["result"], "broken")
                self.assertEqual(result["status"], status)

    def test_persistent_network_failure_is_bounded_and_unconfirmed(self):
        with patch.object(checker.urllib.request, "urlopen", side_effect=urllib.error.URLError("test unavailable")) as opener:
            result = checker.check(URL)
        self.assertEqual(opener.call_count, 2)
        self.assertEqual(result["result"], "not-confirmed")
        self.assertEqual([attempt["reason"] for attempt in result["attempts"]], ["URLError", "URLError"])

    def test_other_errors_are_not_retried(self):
        with patch.object(checker.urllib.request, "urlopen", side_effect=ValueError("invalid response")) as opener:
            result = checker.check(URL)
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(result["result"], "not-confirmed")
        self.assertEqual(result["reason"], "ValueError")


if __name__ == "__main__":
    unittest.main()
