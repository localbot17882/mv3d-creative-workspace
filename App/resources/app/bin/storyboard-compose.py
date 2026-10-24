"""Join ordered local shots into a constant-rate MP4 with synchronized stereo audio."""
import sys,json,math
from fractions import Fraction
import av,numpy as np
from PIL import Image,ImageOps

manifest,target=sys.argv[1:]
files=json.loads(open(manifest,encoding='utf-8').read())
if not 1<=len(files)<=12:raise ValueError('Compose between 1 and 12 shots.')
fps=24;sample_rate=48000
with av.open(files[0]) as first:
    width=first.streams.video[0].width;height=first.streams.video[0].height
if width>3840 or height>3840:raise ValueError('Use shots up to 3840 pixels on the long edge.')
width-=width%2;height-=height%2
packets=[];total=0;offset=0;parts=[]
with av.open(target,'w',options={'movflags':'+faststart'}) as dest:
    video=dest.add_stream('libx264',rate=fps);video.width=width;video.height=height;video.pix_fmt='yuv420p';video.options={'crf':'18','preset':'fast'}
    audio=dest.add_stream('aac',rate=sample_rate);audio.layout='stereo'
    for file in files:
        frames=0;next_time=0;last=None
        with av.open(file) as source:
            stream=source.streams.video[0];rate=float(stream.average_rate or fps);origin=None
            duration=float(stream.duration*stream.time_base) if stream.duration else None
            for i,f in enumerate(source.decode(stream)):
                t=float(f.time) if f.time is not None else i/rate
                if origin is None:origin=t
                t-=origin
                if t+1e-6<next_time:continue
                if f.width!=width or f.height!=height:
                    image=ImageOps.pad(f.to_image().convert('RGB'),(width,height),method=Image.Resampling.LANCZOS,color=(0,0,0));last=np.asarray(image)
                else:last=f.to_ndarray(format='rgb24')
                while next_time<=t+1e-6:
                    frame=av.VideoFrame.from_ndarray(last,format='rgb24');frame.pts=total;frame.time_base=Fraction(1,fps);packets.extend(video.encode(frame));frames+=1;total+=1;next_time=frames/fps
                    if total>24*600:raise ValueError('Use up to ten minutes of footage.')
            target_frames=math.ceil((duration or frames/fps)*fps-1e-6)
            while last is not None and frames<target_frames:
                frame=av.VideoFrame.from_ndarray(last,format='rgb24');frame.pts=total;frame.time_base=Fraction(1,fps);packets.extend(video.encode(frame));frames+=1;total+=1
                if total>24*600:raise ValueError('Use up to ten minutes of footage.')
        if not frames:raise ValueError('One of the shots has no readable video frames.')
        length=frames*sample_rate//fps;chunks=[];read=0
        with av.open(file) as source:
            if source.streams.audio:
                resampler=av.AudioResampler(format='fltp',layout='stereo',rate=sample_rate)
                for f in source.decode(source.streams.audio[0]):
                    for block in resampler.resample(f):
                        chunk=block.to_ndarray();chunks.append(chunk);read+=chunk.shape[1]
                    if read>=length:break
                chunks.extend(f.to_ndarray() for f in resampler.resample(None))
        samples=np.concatenate(chunks,axis=1)[:,:length] if chunks else np.zeros((2,length),np.float32)
        if samples.shape[1]<length:samples=np.pad(samples,((0,0),(0,length-samples.shape[1])))
        for start in range(0,length,1024):
            frame=av.AudioFrame.from_ndarray(np.ascontiguousarray(samples[:,start:start+1024]),format='fltp',layout='stereo');frame.sample_rate=sample_rate;frame.pts=offset+start;frame.time_base=Fraction(1,sample_rate);packets.extend(audio.encode(frame))
        offset+=length;parts.append({'frames':frames,'duration':frames/fps})
    packets.extend(video.encode());packets.extend(audio.encode())
    packets.sort(key=lambda p:float((p.dts if p.dts is not None else p.pts or 0)*p.time_base))
    for packet in packets:dest.mux(packet)
print(json.dumps({'frames':total,'duration':total/fps,'width':width,'height':height,'fps':fps,'shots':parts}))
