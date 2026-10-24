from pathlib import Path
from fractions import Fraction
import sys,wave
import av,numpy as np
from PIL import Image

out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
image=np.zeros((64,96,3),dtype=np.uint8);image[:,:,0]=np.arange(96)[None,:]*2;image[:,:,1]=120;image[:,:,2]=60
Image.fromarray(image).save(out/'fixture.png')
with av.open(str(out/'fixture.mp4'),'w') as clip:
 stream=clip.add_stream('libx264',rate=24);stream.width=96;stream.height=64;stream.pix_fmt='yuv420p'
 for i in range(48):
  frame=av.VideoFrame.from_ndarray(np.roll(image,i,axis=1),format='rgb24');frame.pts=i;frame.time_base=Fraction(1,24)
  for packet in stream.encode(frame):clip.mux(packet)
 for packet in stream.encode():clip.mux(packet)
with wave.open(str(out/'fixture.wav'),'wb') as audio:
 audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(24000)
 audio.writeframes((np.sin(np.arange(48000)/24000*2*np.pi*440)*3000).astype('<i2').tobytes())
print('Synthetic media ready.')
