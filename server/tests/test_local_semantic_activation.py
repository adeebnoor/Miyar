import json
import os
import sys
import types

import numpy as np
import pytest

from server.local_semantic_provider import (
    LocalE5Embeddings, _Session, encode_sentencepiece, normalized_vector, token_windows,
    MAX_SEQUENCE_TOKENS, DIMENSIONS, verify_artifacts,
)
from server.semantic_provider import capability
from server.taxonomy import Catalog


class Tokenizer:
    def encode(self, text, out_type=int):
        return [ord(char) for char in text.rstrip()]

    def normalize(self, text):
        return '▁' + text.strip().replace(' ', '▁')


def test_sentencepiece_mapping_preserves_reserved_tokens_and_normalized_trailing_space():
    ids = encode_sentencepiece(Tokenizer(), 'HR <mask><s></s><pad><unk>')
    assert ids == [ord('H') + 1, ord('R') + 1, 6, 250001, 0, 2, 1, 3]


@pytest.mark.parametrize('kind', ['query', 'passage'])
def test_local_token_windows_preserve_all_context_and_retrieval_prefix_within_256_tokens(kind):
    tokenizer = Tokenizer()
    text = 'مراجعة مخاطر الاستثمار ' * 70 + 'FINAL_CONTEXT_WITHOUT_APPROVAL'
    windows = token_windows(tokenizer, text, kind)
    prefix = encode_sentencepiece(tokenizer, 'query:' if kind == 'query' else 'passage:')
    expected = encode_sentencepiece(tokenizer, ('query: ' if kind == 'query' else 'passage: ') + text)[len(prefix):]
    actual = []
    for ids, weight in windows:
        assert len(ids) <= MAX_SEQUENCE_TOKENS == 256
        assert ids[0] == 0 and ids[-1] == 2 and ids[1:1 + len(prefix)] == prefix
        actual.extend(ids[1 + len(prefix):-1])
        assert weight == len(ids) - len(prefix) - 2
    assert len(windows) > 1 and actual == expected
    with pytest.raises(RuntimeError):
        token_windows(tokenizer, 'x' * 16001, kind)


@pytest.mark.parametrize('value', [np.zeros(DIMENSIONS), np.ones(DIMENSIONS - 1), np.full(DIMENSIONS, np.nan)])
def test_invalid_local_vectors_fail_without_fabricated_similarity(value):
    with pytest.raises(RuntimeError):
        normalized_vector(value)


def test_model_setup_disables_telemetry_and_uses_one_cpu_thread_without_memory_arena(monkeypatch, tmp_path):
    import server.local_semantic_provider as module
    events = []
    monkeypatch.setattr(module, 'verify_artifacts', lambda path: events.append('verified'))

    class Options:
        pass

    class Inference:
        def __init__(self, path, **kwargs):
            assert os.environ['ORT_DISABLE_TELEMETRY'] == '1'
            assert events == ['verified', 'telemetry-disabled']
            options = kwargs['sess_options']
            assert options.intra_op_num_threads == options.inter_op_num_threads == 1
            assert options.enable_cpu_mem_arena is False and options.enable_mem_pattern is False
            assert kwargs['providers'] == ['CPUExecutionProvider']
            events.append('session')

    runtime = types.SimpleNamespace(disable_telemetry_events=lambda: events.append('telemetry-disabled'),
                                    SessionOptions=Options, InferenceSession=Inference,
                                    GraphOptimizationLevel=types.SimpleNamespace(ORT_ENABLE_ALL='all'))
    piece = types.SimpleNamespace(SentencePieceProcessor=lambda **kwargs: Tokenizer())
    monkeypatch.setitem(sys.modules, 'onnxruntime', runtime)
    monkeypatch.setitem(sys.modules, 'sentencepiece', piece)
    _Session(tmp_path)
    assert events == ['verified', 'telemetry-disabled', 'session']


def test_local_model_is_shared_across_catalog_adapters(monkeypatch, tmp_path):
    import server.local_semantic_provider as module
    built = []
    monkeypatch.setenv('MIYAR_MODEL_CACHE', str(tmp_path))

    class Session:
        def __init__(self, directory):
            built.append(directory)

    monkeypatch.setattr(module, '_Session', Session)
    first, second = LocalE5Embeddings(), LocalE5Embeddings()
    assert first.state is second.state and len(built) == 1
    assert first.name == 'intfloat/multilingual-e5-small' and first.dimensions == 384


def test_maximum_api_fields_fit_the_local_composed_query_without_losing_context():
    from server.app import SemanticRequest
    request = SemanticRequest(text='a' * 12000, field='f' * 200, seniority='s' * 200,
                              constraints='c' * 4000)
    text = request.retrieval_text()
    assert len(text) == 12420
    assert request.text in text and request.field in text and request.seniority in text
    windows = token_windows(Tokenizer(), text, 'query')
    prefix = encode_sentencepiece(Tokenizer(), 'query:')
    encoded = encode_sentencepiece(Tokenizer(), 'query: ' + text)[len(prefix):]
    assert [token for ids, weight in windows for token in ids[1 + len(prefix):-1]] == encoded
    assert all(len(ids) <= 256 for ids, weight in windows)


def test_missing_local_artifact_is_rejected_before_inference(tmp_path):
    with pytest.raises(RuntimeError, match='checksum'):
        verify_artifacts(tmp_path)


def test_local_flat_index_contains_all_5078_vectors_and_reuses_read_only_cache(monkeypatch, tmp_path):
    import server.local_semantic_provider as module
    monkeypatch.setenv('MIYAR_ENABLE_EMBEDDINGS', 'true')
    monkeypatch.setenv('MIYAR_EMBEDDING_PROVIDER', 'local-e5-small')
    monkeypatch.setenv('MIYAR_MODEL_CACHE', str(tmp_path))
    calls = []

    class Model:
        name = 'intfloat/multilingual-e5-small'
        dimensions = 384
        fingerprint = 'synthetic-local-index'

        def __call__(self, texts, kind):
            calls.append((len(texts), kind))
            return [[1.] + [0.] * 383 for text in texts]

    monkeypatch.setattr(module, 'LocalE5Embeddings', Model)
    caps = capability()
    assert caps['configured'] and not caps['externalProcessing'] and caps['dimensions'] == 384
    assert caps['model'] == 'intfloat/multilingual-e5-small'
    first = Catalog()
    first.load_semantic()
    assert len(calls) == 5078
    status = first.semantic_status()
    assert status['modelReady'] and status['totalDocuments'] == status['indexedDocuments'] == 5078
    assert first.matrix.shape == (5041, 384) and first.skill_matrix.shape == (37, 384)
    assert first.matrix.nbytes + first.skill_matrix.nbytes == 7799808
    assert not first.matrix.flags.writeable and not first.skill_matrix.flags.writeable
    second = Catalog()
    second.load_semantic()
    assert len(calls) == 5078 and second.semantic_status()['modelReady']
    assert 'private' not in json.dumps(status)
