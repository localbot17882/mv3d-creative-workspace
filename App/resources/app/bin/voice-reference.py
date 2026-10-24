import sys,json,av,numpy as np,wave
source,target=sys.argv[1:]
resampler=av.AudioResampler(format='s16',layout='mono',rate=24000);chunks=[];samples=0
with av.open(source) as stream:
    if not stream.streams.audio:raise ValueError('No audio track found in the reference.')
    for frame in stream.decode(audio=0):
        for f in resampler.resample(frame):
            a=f.to_ndarray().reshape(-1);chunks.append(a);samples+=len(a)
        if samples>24000*30:raise ValueError('Choose a voice reference between 3 and 30 seconds.')
    for f in resampler.resample(None):chunks.append(f.to_ndarray().reshape(-1))
audio=np.concatenate(chunks)
if len(audio)<24000*3:raise ValueError('Use at least 3 seconds of clear speech.')
with wave.open(target,'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(24000);out.writeframes(audio.astype('<i2').tobytes())
print(json.dumps({'duration':len(audio)/24000}))
