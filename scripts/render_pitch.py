"""Render reviewed pitch PDFs to browser previews; keep PDFs searchable."""
from pathlib import Path
import subprocess
from PIL import Image
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
output = root / 'dist/pitch/slides'
output.mkdir(exist_ok=True)
for lang in ('ar', 'en'):
    pdf = root / f'dist/pitch/Miyar-Pitch-{lang.upper()}.pdf'
    reader = PdfReader(pdf)
    assert len(reader.pages) == 18
    assert all(len(page.extract_text()) > 30 for page in reader.pages)
    links = [a.get_object().get('/A', {}).get('/URI')
             for a in reader.pages[-1].get('/Annots', [])]
    assert 'https://adeebnoor.github.io/Miyar/' in links
    render = root / f'tmp/pitch-build/final-{lang}'
    render.mkdir(parents=True, exist_ok=True)
    subprocess.run(['pdftoppm', '-png', '-scale-to', '1601', str(pdf), str(render/'slide')], check=True)
    for i in range(1, 19):
        with Image.open(render/f'slide-{i:02}.png') as image:
            image.convert('RGB').save(output/f'{lang}-{i:02}.jpg', quality=92, optimize=True)
    print(f'{lang}: 18 searchable PDF pages, website link and slide previews verified')
