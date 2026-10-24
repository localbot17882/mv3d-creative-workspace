import io,sys,warnings
from PIL import Image
Image.MAX_IMAGE_PIXELS=25000000
warnings.simplefilter('error',Image.DecompressionBombWarning)
raw=sys.stdin.buffer.read(5000001)
if len(raw)>5000000:raise ValueError('Example too large')
image=Image.open(io.BytesIO(raw));image.thumbnail((360,180))
if image.mode not in ('RGB','L'):image=image.convert('RGB')
image.save(sys.stdout.buffer,format='JPEG',quality=75)
