import sys,json,io,base64,av
file=sys.argv[1];images=[]
with av.open(file) as clip:
    duration=clip.duration/av.time_base if clip.duration else float(clip.streams.video[0].duration*clip.streams.video[0].time_base)
    for point in [0.1,0.5,0.9]:
        target=max(0,duration*point);clip.seek(int(target*av.time_base))
        for frame in clip.decode(video=0):
            if frame.time is not None and frame.time+0.1<target:continue
            image=frame.to_image();image.thumbnail((960,960));out=io.BytesIO();image.save(out,format='JPEG',quality=80);images.append('data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode());break
print(json.dumps({'images':images,'duration':duration}))
