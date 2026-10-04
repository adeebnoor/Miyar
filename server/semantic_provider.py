"""Opt-in, server-side multilingual embeddings for occupation and skill retrieval.

Corpus documents are public reference labels. User text is embedded only after the
calling API enforces authentication and external-processing consent. This module
does not generate descriptions, invent scores or create an implicit provider.
"""
import os
import re
import math

import httpx

from .domain import digest
from .strategic import Unavailable, provider_post, unit

DIMENSIONS = 768
BATCH_SIZE = 100
QUERY_CHUNK_CHARACTERS = 1200
MAX_QUERY_CHARACTERS = 16000


def query_chunks(text):
    """Keep all query context; prefer word boundaries within the bounded budget."""
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_QUERY_CHARACTERS:
        raise Unavailable('Embedding input is empty or exceeds the length limit')
    remaining = text.strip()
    slots = math.ceil(len(remaining) / QUERY_CHUNK_CHARACTERS)
    chunks = []
    while remaining:
        limit = min(len(remaining), QUERY_CHUNK_CHARACTERS)
        # A boundary must still leave enough space in the remaining <=14 slots.
        minimum = max(1, len(remaining) - (slots - 1) * QUERY_CHUNK_CHARACTERS)
        if len(remaining) > limit:
            boundaries = [match.end() for match in re.finditer(r'\s', remaining[:limit])
                          if match.end() >= minimum]
            if boundaries:
                limit = boundaries[-1]
        chunk = remaining[:limit]
        if chunk.strip():
            chunks.append(chunk)
        remaining = remaining[limit:]
        slots -= 1
    return chunks


def capability():
    enabled = os.getenv('MIYAR_ENABLE_EMBEDDINGS') == 'true'
    provider = os.getenv('MIYAR_EMBEDDING_PROVIDER', 'local')
    model = (os.getenv('MIYAR_EMBEDDING_MODEL') or
             os.getenv('MIYAR_STRATEGIC_EMBEDDING_MODEL', '')) if provider == 'gemini' else os.getenv(
                 'MIYAR_EMBEDDING_MODEL', 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
    configured = provider == 'local' or (
        provider == 'gemini' and bool(os.getenv('MIYAR_STRATEGIC_GEMINI_KEY'))
        and bool(re.fullmatch(r'gemini-embedding-[a-zA-Z0-9._-]+', model)))
    return {'enabled': enabled, 'configured': bool(enabled and configured),
            'provider': provider, 'model': model,
            'dimensions': DIMENSIONS if provider == 'gemini' else 384,
            'externalProcessing': provider == 'gemini'}


class GeminiOccupationEmbeddings:
    """The same model, dimensionality and retrieval task pair for the full index."""

    def __init__(self):
        caps = capability()
        if not caps['configured'] or caps['provider'] != 'gemini':
            raise Unavailable('Configure the server-side semantic embedding provider')
        self.name = caps['model']
        self.dimensions = DIMENSIONS
        self.fingerprint = digest({'provider': 'Google Gemini', 'model': self.name,
                                   'dimensions': DIMENSIONS,
                                   'documentTask': 'RETRIEVAL_DOCUMENT',
                                   'queryTask': 'RETRIEVAL_QUERY', 'normalization': 'l2',
                                   'queryPooling': 'length-weighted-mean-normalized',
                                   'queryChunkCharacters': QUERY_CHUNK_CHARACTERS})

    def __call__(self, texts, kind):
        if kind not in {'query', 'passage'} or not isinstance(texts, list) or not 1 <= len(texts) <= BATCH_SIZE:
            raise Unavailable('Embedding batches must contain 1 to 100 texts')
        if any(not isinstance(text, str) or not text.strip() or len(text) > 16000 for text in texts):
            raise Unavailable('Embedding input is empty or exceeds the length limit')
        key = os.getenv('MIYAR_STRATEGIC_GEMINI_KEY', '')
        if not key:
            raise Unavailable('The configured server-side embedding credential is unavailable')
        requests = [{'model': 'models/' + self.name,
                     'content': {'parts': [{'text': text}]},
                     'taskType': 'RETRIEVAL_QUERY' if kind == 'query' else 'RETRIEVAL_DOCUMENT',
                     'outputDimensionality': DIMENSIONS} for text in texts]
        try:
            with httpx.Client(timeout=60, follow_redirects=False) as client:
                response = provider_post(
                    client, 'https://generativelanguage.googleapis.com/v1beta/models/' + self.name + ':batchEmbedContents',
                    headers={'x-goog-api-key': key}, json={'requests': requests})
                response.raise_for_status()
                if len(response.content) > 5_000_000:
                    raise Unavailable('Embedding response exceeds the size limit')
                rows = response.json()['embeddings']
                if not isinstance(rows, list) or len(rows) != len(texts):
                    raise Unavailable('Embedding response is incomplete')
                vectors = [unit(row['values']) for row in rows]
                if any(len(vector) != DIMENSIONS for vector in vectors):
                    raise Unavailable('Embedding provider returned a different dimensionality')
                return vectors
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise Unavailable('Semantic embedding provider is unavailable; no similarity was fabricated') from error

    def embed(self, texts):
        vectors = []
        for text in texts:
            chunks = query_chunks(text)
            rows = self(chunks, 'query')
            if len(rows) == 1:
                vectors.append(rows[0])
                continue
            weights = [len(chunk) for chunk in chunks]
            total = sum(weights)
            pooled = [sum(row[index] * weight for row, weight in zip(rows, weights)) / total
                      for index in range(DIMENSIONS)]
            vectors.append(unit(pooled))
        return iter(vectors)

    def query_metadata(self, text):
        count = len(query_chunks(text))
        return {'queryChunks': count,
                'queryPooling': 'length-weighted-mean-normalized' if count > 1 else 'single-query-vector',
                'queryChunkCharacters': QUERY_CHUNK_CHARACTERS}
