"""One-off recolour of the React app: dark green/lime -> warm light theme (cream, white, indigo, coral accents).

Run from the repo root:  python evaluation/scripts/_recolor.py
Context rules matter: #080B0A was BOTH the page background and the dark text used on lime buttons.
"""
import re
from pathlib import Path

SRC = Path('frontend/src')

# text colour on an accent background (was dark text on lime) -> white on indigo
TEXT_ON_ACCENT = [
    (re.compile(r'''(\bcolor\s*=\s*["{']*\s*["']?)#080B0A''', re.I), r'\1#FFFFFF'),
    (re.compile(r'''(\bcolor\s*:\s*["'])#080B0A''', re.I), r'\1#FFFFFF'),
]

HEX = {
    # page / surfaces
    '#080B0A': '#FBF8F4', '#0D120E': '#FFFFFF', '#111713': '#FFFFFF', '#182019': '#F5F0EA', '#0F1A11': '#F7F3EE',
    '#1A2A1C': '#EFE8DF', '#1F2F22': '#E9E1D6', '#1C2A1E': '#EFE8DF', '#2A3A2C': '#E3DACF', '#3A4A3C': '#CFC4B6',
    # text
    '#F4F7F0': '#1E2233', '#A5B1A7': '#5B6277', '#6B7B6D': '#8A90A2', '#5A6B5C': '#9AA0B2',
    # accent: lime -> indigo
    '#B7FF35': '#5B5BF0', '#8DDB39': '#4747DB', '#7BC82E': '#4747DB', '#6FBB20': '#3B3BC4', '#5FA020': '#3B3BC4',
    '#3A6A10': '#2E2E96', '#1A3A05': '#1F1F6B', '#F0FFE0': '#EEF0FF', '#D4FFAA': '#DDE0FF', '#C5FF6B': '#C5CAFF',
    # status
    '#FF4444': '#E5484D', '#FF6B6B': '#E5484D', '#FF6666': '#E5484D', '#FF8888': '#E5484D', '#FF9999': '#E5484D', '#FF8A80': '#E5484D',
    '#FFB800': '#C77700', '#FFB4B4': '#B42318', '#FFB3B3': '#B42318', '#2A1313': '#FEECEC', '#132A17': '#E7F8EE', '#4ECDC4': '#0F9B8E',
}

RGBA = [
    (re.compile(r'rgba\(\s*183\s*,\s*255\s*,\s*53\s*,'), 'rgba(91,91,240,'),
    (re.compile(r'rgba\(\s*8\s*,\s*11\s*,\s*10\s*,'), 'rgba(251,248,244,'),
    (re.compile(r'rgba\(\s*255\s*,\s*68\s*,\s*68\s*,'), 'rgba(229,72,77,'),
    (re.compile(r'rgba\(\s*42\s*,\s*58\s*,\s*44\s*,'), 'rgba(227,218,207,'),
    # heavy black modal scrims -> soft ink scrim
    (re.compile(r'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.(8|85|88|9)\s*\)'), 'rgba(30,34,51,0.55)'),
]

hex_re = re.compile(r'#[0-9A-Fa-f]{6}\b')
changed = 0
for f in sorted(SRC.rglob('*.ts*')):
    if f.name == 'theme.ts':
        continue
    s0 = s = f.read_text(encoding='utf-8')
    for rx, rep in TEXT_ON_ACCENT:
        s = rx.sub(rep, s)
    s = hex_re.sub(lambda m: HEX.get(m.group(0).upper(), m.group(0)), s)
    for rx, rep in RGBA:
        s = rx.sub(rep, s)
    if s != s0:
        f.write_text(s, encoding='utf-8')
        changed += 1
print('files changed:', changed)
