"""Build the public local index into the image; never download models in requests."""
import json
import os
from pathlib import Path
from urllib.request import urlopen

from .local_semantic_provider import ARTIFACTS, REPOSITORY, REVISION, file_digest, model_directory


def prepare_artifacts():
    directory = model_directory()
    for filename, (size, checksum) in ARTIFACTS.items():
        path = directory / filename
        if path.is_file() and path.stat().st_size == size and file_digest(path) == checksum:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + '.download')
        total = 0
        try:
            url = 'https://huggingface.co/' + REPOSITORY + '/resolve/' + REVISION + '/' + filename
            with urlopen(url, timeout=60) as response, temporary.open('wb') as target:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > size:
                        raise RuntimeError('Pinned semantic download exceeds its expected size')
                    target.write(chunk)
            if total != size or file_digest(temporary) != checksum:
                raise RuntimeError('Pinned semantic download failed checksum validation')
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    return directory


def main():
    os.environ['MIYAR_ENABLE_EMBEDDINGS'] = 'true'
    os.environ['MIYAR_EMBEDDING_PROVIDER'] = 'local-e5-small'
    prepare_artifacts()
    from .taxonomy import Catalog
    catalog = Catalog()
    catalog.load_semantic()
    print(json.dumps({'localSemanticIndex': catalog.semantic_status(),
                      'matrixBytes': catalog.matrix.nbytes + catalog.skill_matrix.nbytes}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
