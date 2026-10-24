import sys,av
from fractions import Fraction
source,dest=sys.argv[1:]
with av.open(source) as src,av.open(dest,'w',options={'movflags':'+faststart'}) as out:
    vin=src.streams.video[0]
    vout=out.add_stream('libx264',rate=30);vout.width=vin.width+vin.width%2;vout.height=vin.height+vin.height%2;vout.pix_fmt='yuv420p';vout.options={'crf':'20','preset':'veryfast'}
    vout.time_base=Fraction(1,90000);vout.codec_context.time_base=Fraction(1,90000);last_pts=-1
    ain=src.streams.audio[0] if src.streams.audio else None
    aout=out.add_stream('aac',rate=48000) if ain else None
    if aout:aout.layout='stereo'
    resampler=av.AudioResampler(format='fltp',layout='stereo',rate=48000) if ain else None
    for packet in src.demux([vin]+([ain] if ain else [])):
        for frame in packet.decode():
            if isinstance(frame,av.VideoFrame):
                timestamp=float(frame.time or 0)
                frame=frame.reformat(width=vout.width,height=vout.height,format='yuv420p')
                frame.time_base=Fraction(1,90000);frame.pts=max(last_pts+1,round(timestamp*90000));last_pts=frame.pts
                for p in vout.encode(frame):out.mux(p)
            elif aout:
                for f in resampler.resample(frame):
                    for p in aout.encode(f):out.mux(p)
    for p in vout.encode():out.mux(p)
    if aout:
        for f in resampler.resample(None):
            for p in aout.encode(f):out.mux(p)
        for p in aout.encode():out.mux(p)
