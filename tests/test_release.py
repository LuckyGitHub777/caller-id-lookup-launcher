import hashlib
import json
import re
import unittest
from pathlib import Path
from urllib.parse import unquote,urlparse
ROOT=Path(__file__).resolve().parents[1]

class ReleaseTest(unittest.TestCase):
 def test_manifest(self):
  seen=set()
  for line in (ROOT/'MANIFEST.sha256').read_text(encoding='utf-8').splitlines():
   m=re.fullmatch(r'([0-9a-f]{64})  ([^\n]+)',line)
   self.assertIsNotNone(m,line)
   digest,p=m.groups();self.assertNotIn(p,seen);seen.add(p)
   self.assertTrue((ROOT/p).is_file(),p)
   self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),digest,p)
  actual={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts}
  actual.difference_update({'MANIFEST.sha256','.github/workflows/verify.yml'})
  self.assertEqual(seen,actual)
 def test_readme_focus(self):
  readme=(ROOT/'README.md').read_text(encoding='utf-8')
  self.assertRegex(readme, r'(?m)^#\s+\S')
  for href in re.findall(r'\]\(([^)]+)\)',readme):
   if urlparse(href).scheme:continue
   self.assertTrue((ROOT/href.split('#')[0]).is_file(),href)
 def test_internal_html_assets(self):
  for file in ROOT.rglob('*.html'):
   source=file.read_text(encoding='utf-8')
   self.assertNotRegex(source,r'<script[^>]+src=["\']https?://')
   for link in re.findall(r'(?:src|href)=["\']([^"\']+)["\']',source):
    if link.startswith(('data:','#','mailto:','tel:','//')) or urlparse(link).scheme:continue
    rel=unquote(link.split('?',1)[0].split('#',1)[0])
    if rel in ('','.','./') or rel.startswith('/'):continue
    self.assertTrue((file.parent/rel).is_file(),f'{file.name}:{link}')
 def test_json(self):
  for file in list(ROOT.rglob('*.json'))+list(ROOT.rglob('*.webmanifest')):
   json.loads(file.read_text(encoding='utf-8'))
if __name__=='__main__':unittest.main()
