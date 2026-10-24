"""Replace a video's audio with a supplied track, trimmed/padded to video duration."""
import sys
import av
import numpy as np
video_file,audio_file,output=sys.argv[1:]
with av.open(video_file) as source, av.open(audio_file) as audio, av.open(output,'w') as dest:
    vs=source.streams.video[0]
    duration=float(vs.duration*vs.time_base) if vs.duration else source.duration/av.time_base
    out_video=dest.add_stream_from_template(vs)
    out_audio=dest.add_stream('aac',rate=48000);out_audio.layout='stereo'
    resampler=av.AudioResampler(format='fltp',layout='stereo',rate=48000)
    chunks=[]
    for frame in audio.decode(audio=0):
        chunks.extend(f.to_ndarray() for f in resampler.resample(frame))
        if sum(c.shape[1] for c in chunks)>=int(duration*48000):break
    chunks.extend(f.to_ndarray() for f in resampler.resample(None))
    samples=np.concatenate(chunks,axis=1) if chunks else np.zeros((2,0),dtype=np.float32)
    length=int(round(duration*48000));samples=samples[:,:length]
    if samples.shape[1]<length:samples=np.pad(samples,((0,0),(0,length-samples.shape[1])))
    packets=[]
    for offset in range(0,length,1024):
        frame=av.AudioFrame.from_ndarray(np.ascontiguousarray(samples[:,offset:offset+1024]),format='fltp',layout='stereo');frame.sample_rate=48000;frame.pts=offset
        packets.extend(out_audio.encode(frame))
    packets.extend(out_audio.encode(None))
    for packet in source.demux(vs):
        if packet.dts is not None:packet.stream=out_video;packets.append(packet)
    packets.sort(key=lambda p:float(p.dts*p.time_base) if p.dts is not None else 0)
    for packet in packets:dest.mux(packet)
print('Video and audio combined.')
