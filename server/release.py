"""Release identity is generated once and shared with the static frontend."""
import json
from pathlib import Path
RELEASE = json.loads((Path(__file__).resolve().parent.parent / 'dist' / 'release.json').read_text())
VERSION = RELEASE['version']
