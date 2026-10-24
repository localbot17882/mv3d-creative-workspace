"""Deterministically upscale existing frames; preserve motion, timing and audio."""
import sys,json,av
source,target,scale=sys.argv[1:];scale=int(scale)
if scale not in [2,4]:raise ValueError('Choose 2x or 4x.')
with av.open(source) as src,av.open(target,'w',options={'movflags':'+faststart'}) as dst:
    vin=src.streams.video[0];width=vin.width*scale;height=vin.height*scale
    if width>7680 or height>7680:raise ValueError('Use a smaller draft or scale factor.')
    vout=dst.add_stream('libx264',rate=vin.average_rate or 24);vout.width=width;vout.height=height;vout.pix_fmt='yuv420p';vout.options={'crf':'17','preset':'fast'}
    audio=src.streams.audio[0] if src.streams.audio else None;aout=dst.add_stream_from_template(audio) if audio else None;packets=[];count=0
    for p in src.demux([vin]+([audio] if audio else [])):
        if p.stream==vin:
            for f in p.decode():
                frame=f.reformat(width=width,height=height,interpolation='LANCZOS');frame.pts=f.pts;frame.time_base=f.time_base;packets.extend(vout.encode(frame));count+=1
        elif p.dts is not None:p.stream=aout;packets.append(p)
    packets.extend(vout.encode());packets.sort(key=lambda p:float((p.dts if p.dts is not None else p.pts or 0)*p.time_base))
    for p in packets:dst.mux(p)
print(json.dumps({'width':width,'height':height,'frames':count,'newFramesGenerated':False,'method':'Lanczos'}))
