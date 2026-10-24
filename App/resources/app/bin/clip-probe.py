import av,json,sys,base64,io
with av.open(sys.argv[1]) as container:
 stream=container.streams.video[0]
 duration=float(stream.duration*stream.time_base) if stream.duration else float(container.duration or 0)/av.time_base
 image=next(container.decode(stream)).to_image().convert('RGB');image.thumbnail((640,640));buffer=io.BytesIO();image.save(buffer,format='PNG')
 print(json.dumps({'width':stream.width,'height':stream.height,'fps':float(stream.average_rate or 24),'duration':duration,'hasAudio':bool(container.streams.audio),'poster':base64.b64encode(buffer.getvalue()).decode()}))
