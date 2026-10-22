"""Side-by-side and overlay of an office render against the reference's office region.
Usage: python3 scripts/office-preview/compare.py render.png  -> render-compare.png, render-overlay.png"""
import sys
from pathlib import Path
from PIL import Image

REF = Path(__file__).resolve().parents[2] / 'docs' / 'reference.png'
BOX = (172, 80, 1232, 880)

shot_path = Path(sys.argv[1])
ref = Image.open(REF).convert('RGB').crop(BOX)
shot = Image.open(shot_path).convert('RGB').resize(ref.size)
side = Image.new('RGB', (ref.width * 2 + 10, ref.height), 'white')
side.paste(ref, (0, 0))
side.paste(shot, (ref.width + 10, 0))
side.save(shot_path.with_name(shot_path.stem + '-compare.png'))
Image.blend(ref, shot, 0.5).save(shot_path.with_name(shot_path.stem + '-overlay.png'))
print('saved', shot_path.with_name(shot_path.stem + '-compare.png'))
