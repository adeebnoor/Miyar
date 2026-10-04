"""Pinned multilingual E5 int8 inference with bounded memory and no network.

The public model files are downloaded and verified during image construction.
Serving uses one serialized ONNX session and the exact XLM-R SentencePiece IDs;
it never imports the much larger Rust tokenizer or the FastEmbed model registry.
"""
import hashlib
import math
import os
import re
import threading
from pathlib import Path

# Set this before the first ONNX Runtime import; the API is also disabled below.
os.environ['ORT_DISABLE_TELEMETRY'] = '1'

import numpy as np

from .domain import digest

MODEL = 'intfloat/multilingual-e5-small'
REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78'
REPOSITORY = 'Xenova/multilingual-e5-small'
DIMENSIONS = 384
MAX_INPUT_CHARACTERS = 16000
MAX_SEQUENCE_TOKENS = 256
ARTIFACTS = {
    'onnx/model_quantized.onnx': (118308185, 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193'),
    'sentencepiece.bpe.model': (5069051, 'cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865'),
}
SPECIAL_IDS = {'<s>': 0, '<pad>': 1, '</s>': 2, '<unk>': 3, '<mask>': 250001}
SPECIAL_PATTERN = re.compile('(' + '|'.join(re.escape(token) for token in SPECIAL_IDS) + ')')
_shared = {}
_shared_lock = threading.Lock()


def model_directory():
    root = Path(__file__).resolve().parent.parent
    return Path(os.getenv('MIYAR_MODEL_CACHE', str(root / '.model-cache'))) / 'local-e5-small'


def file_digest(path):
    checksum = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def verify_artifacts(directory):
    for filename, (size, sha256) in ARTIFACTS.items():
        path = Path(directory) / filename
        if not path.is_file() or path.stat().st_size != size or file_digest(path) != sha256:
            raise RuntimeError('Pinned local semantic artifacts are missing or fail checksum validation')


def encode_sentencepiece(tokenizer, text):
    """Match the pinned HF tokenizer, including raw special-token boundaries."""
    ids = []
    for part in SPECIAL_PATTERN.split(text):
        if part in SPECIAL_IDS:
            ids.append(SPECIAL_IDS[part])
        elif part:
            ids.extend(value + 1 if value else 3 for value in tokenizer.encode(part, out_type=int))
            # SentencePiece removes a final normalized space; HF Metaspace keeps it.
            if tokenizer.normalize(part + 'X').endswith('▁X'):
                ids.append(6)
    return ids


def token_windows(tokenizer, text, kind):
    if kind not in {'query', 'passage'} or not isinstance(text, str) or not text.strip() or len(text) > MAX_INPUT_CHARACTERS:
        raise RuntimeError('Local semantic input is empty or exceeds the length limit')
    prefix = ('query: ' if kind == 'query' else 'passage: ')
    prefix_ids = encode_sentencepiece(tokenizer, prefix.rstrip())
    ids = encode_sentencepiece(tokenizer, prefix + text)
    if ids[:len(prefix_ids)] != prefix_ids:
        raise RuntimeError('The pinned semantic tokenizer returned an invalid retrieval prefix')
    body = ids[len(prefix_ids):]
    width = MAX_SEQUENCE_TOKENS - len(prefix_ids) - 2
    if not body or width <= 0:
        raise RuntimeError('Local semantic input has no usable tokens')
    return [([0, *prefix_ids, *body[first:first + width], 2], len(body[first:first + width]))
            for first in range(0, len(body), width)]


def normalized_vector(value):
    vector = np.asarray(value, dtype=np.float32)
    if vector.shape != (DIMENSIONS,) or not np.isfinite(vector).all():
        raise RuntimeError('Local semantic inference returned invalid vector values')
    length = float(np.linalg.norm(vector))
    if not math.isfinite(length) or length <= 0:
        raise RuntimeError('Local semantic inference returned an empty vector')
    return vector / length


class _Session:
    def __init__(self, directory):
        verify_artifacts(directory)
        os.environ['ORT_DISABLE_TELEMETRY'] = '1'
        import onnxruntime as ort
        import sentencepiece as spm
        ort.disable_telemetry_events()
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(Path(directory) / 'onnx/model_quantized.onnx'),
                                            providers=['CPUExecutionProvider'], sess_options=options)
        self.tokenizer = spm.SentencePieceProcessor(model_file=str(Path(directory) / 'sentencepiece.bpe.model'))
        self.lock = threading.RLock()

    def vector(self, text, kind):
        with self.lock:
            windows = token_windows(self.tokenizer, text, kind)
            rows = []
            weights = []
            for ids, weight in windows:
                input_ids = np.asarray([ids], dtype=np.int64)
                hidden = self.session.run(None, {'input_ids': input_ids,
                                                'attention_mask': np.ones_like(input_ids),
                                                'token_type_ids': np.zeros_like(input_ids)})[0]
                if hidden.shape != (1, len(ids), DIMENSIONS) or not np.isfinite(hidden).all():
                    raise RuntimeError('Local semantic model returned invalid token features')
                # One document per inference: every attention-mask entry is one.
                rows.append(normalized_vector(hidden[0].mean(axis=0, dtype=np.float32)))
                weights.append(weight)
            return normalized_vector(np.average(np.asarray(rows), axis=0, weights=weights))


class LocalE5Embeddings:
    name = MODEL
    dimensions = DIMENSIONS
    fingerprint = digest({'model': MODEL, 'revision': REVISION, 'artifacts': ARTIFACTS,
                          'pooling': 'attention-mask-mean-l2', 'runtime': 'onnxruntime-1.30.0',
                          'tokenizer': 'sentencepiece-0.2.1-exact-xlmr-ids-v1',
                          'longInput': 'token-count-weighted-mean-normalized', 'windowTokens': MAX_SEQUENCE_TOKENS})

    def __init__(self):
        directory = model_directory().resolve()
        with _shared_lock:
            if str(directory) not in _shared:
                _shared[str(directory)] = _Session(directory)
            self.state = _shared[str(directory)]

    def __call__(self, texts, kind):
        return [self.state.vector(text, kind).tolist() for text in texts]

    def embed(self, texts):
        return iter(self(list(texts), 'query'))

    def query_metadata(self, text):
        with self.state.lock:
            windows = token_windows(self.state.tokenizer, text, 'query')
        return {'queryChunks': len(windows),
                'queryPooling': 'token-count-weighted-mean-normalized' if len(windows) > 1 else 'single-query-vector',
                'queryChunkTokens': MAX_SEQUENCE_TOKENS}
