import sys,json,av,numpy as np
config=json.load(open(sys.argv[1],encoding='utf-8'));rate=48000
def audio(file):
    chunks=[];resampler=av.AudioResampler(format='fltp',layout='stereo',rate=rate)
    with av.open(file) as src:
        if not src.streams.audio:return np.zeros((2,0),dtype=np.float32)
        for frame in src.decode(audio=0):chunks.extend(f.to_ndarray() for f in resampler.resample(frame))
        chunks.extend(f.to_ndarray() for f in resampler.resample(None))
    return np.concatenate(chunks,axis=1) if chunks else np.zeros((2,0),dtype=np.float32)
with av.open(config['video']) as src,av.open(config['output'],'w',options={'movflags':'+faststart'}) as dest:
    vs=src.streams.video[0];duration=float(vs.duration*vs.time_base) if vs.duration else src.duration/av.time_base;length=round(duration*rate)
    ambient=np.concatenate([audio(f) for f in config['ambient']],axis=1) if config['ambient'] else np.zeros((2,0),dtype=np.float32)
    voice=audio(config['voice']) if config.get('voice') else np.zeros((2,0),dtype=np.float32)
    def fitted(x):return np.pad(x[:,:length],((0,0),(0,max(0,length-x.shape[1]))))
    voice=fitted(voice);ambient=fitted(ambient);mask=np.max(np.abs(voice),axis=0)>0.015;duck=np.where(mask,0.4,1.0)
    mixed=ambient*float(config['ambientLevel'])*duck+voice*float(config['voiceLevel'])
    if config.get('keepOriginal'):mixed+=fitted(audio(config['video']))*0.25
    peak=float(np.max(np.abs(mixed))) if mixed.size else 0
    if peak>0.98:mixed*=0.98/peak
    out_video=dest.add_stream_from_template(vs);out_audio=dest.add_stream('aac',rate=rate);out_audio.layout='stereo'
    packets=[]
    for pos in range(0,length,1024):
        frame=av.AudioFrame.from_ndarray(np.ascontiguousarray(mixed[:,pos:pos+1024],dtype=np.float32),format='fltp',layout='stereo');frame.sample_rate=rate;frame.pts=pos;frame.time_base=__import__('fractions').Fraction(1,rate);packets.extend(out_audio.encode(frame))
    packets.extend(out_audio.encode())
    for packet in src.demux(vs):
        if packet.dts is not None:packet.stream=out_video;packets.append(packet)
    packets.sort(key=lambda p:float((p.dts if p.dts is not None else p.pts or 0)*p.time_base))
    for packet in packets:dest.mux(packet)
print(json.dumps({'duration':duration,'videoReencoded':False}))
