# Side-by-side and overlay comparison of a screenshot against docs/reference.png.
# Usage: python3 scripts/compare.py .shots/app.png .shots/compare.png
import sys
from PIL import Image
ref = Image.open('docs/reference.png').convert('RGB')
shot = Image.open(sys.argv[1]).convert('RGB').resize(ref.size)
W, H = ref.size
out = Image.new('RGB', (W * 2, H), 'black')
out.paste(ref, (0, 0)); out.paste(shot, (W, 0))
out.save(sys.argv[2])
Image.blend(ref, shot, 0.5).save(sys.argv[2].replace('.png', '-overlay.png'))
print('saved', sys.argv[2])
