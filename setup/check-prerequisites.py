import json
import sys
from pathlib import Path

if sys.version_info[:2] != (3, 12):
    raise SystemExit('Python 3.12 is required.')
with (Path(__file__).resolve().parent.parent / 'package-lock.json').open(encoding='utf-8') as source:
    json.load(source)
print('Python 3.12 and package lock validated.')
