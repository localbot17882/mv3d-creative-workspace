"""Bounded local video input; fits the whole frame and keeps synchronized audio."""
from pathlib import Path
import math
import comfy.model_management as mm
import av
import numpy as np
import torch
from PIL import Image,ImageOps
import folder_paths

class ComfyLabLoadClip:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'file':('STRING',),'width':('INT',{'min':64,'max':3840,'default':512}),'height':('INT',{'min':64,'max':2176,'default':320}),'duration':('INT',{'min':0,'max':10,'default':2}),'fps':('INT',{'min':24,'max':24,'default':24}),'preserve_audio':('BOOLEAN',{'default':True})}}
    RETURN_TYPES=('IMAGE','INT','AUDIO')
    RETURN_NAMES=('images','frames','audio')
    FUNCTION='load'
    CATEGORY='Comfy Lab/video'

    def load(self,file,width,height,duration,fps,preserve_audio):
        root=Path(folder_paths.get_input_directory()).resolve();source=(root/file).resolve()
        if source.parent!=root or not source.is_file() or not source.name.startswith('comfy-lab-clip-'):raise ValueError('Choose a clip through Comfy Lab first.')
        full=duration==0
        cap=math.inf if full else duration*fps+1;images=[];next_time=0;origin=None
        with av.open(str(source)) as container:
            stream=container.streams.video[0];rate=float(stream.average_rate or fps)
            seconds=float(stream.duration*stream.time_base) if stream.duration else None
            for index,frame in enumerate(container.decode(stream)):
                mm.throw_exception_if_processing_interrupted()
                t=float(frame.time) if frame.time is not None else index/rate
                if origin is None:origin=t
                t-=origin
                if t+0.0001<next_time:continue
                image=np.asarray(ImageOps.pad(frame.to_image().convert('RGB'),(width,height),method=Image.Resampling.LANCZOS,color=(0,0,0)),dtype=np.uint8)
                while next_time<=t+0.0001 and len(images)<cap:
                    images.append(image);next_time=len(images)/fps
                if len(images)>=cap:break
        if full and images:
            seconds=seconds or len(images)/fps
            target=max(len(images),math.ceil(seconds*fps))
            count=math.ceil((target-1)/8)*8+1
            images.extend([images[-1]]*(count-len(images)))
        else:count=((len(images)-1)//8)*8+1
        if count<9:raise ValueError('The input clip must contain at least 9 frames at 24 fps.')
        frames=torch.from_numpy(np.stack(images[:count])).float().div_(255)
        samples=int(round(count/fps*48000));audio=np.zeros((2,samples),dtype=np.float32)
        if preserve_audio:
            with av.open(str(source)) as container:
                if container.streams.audio:
                    resampler=av.AudioResampler(format='fltp',layout='stereo',rate=48000);offset=0
                    for frame in container.decode(container.streams.audio[0]):
                        for converted in resampler.resample(frame):
                            chunk=converted.to_ndarray();n=min(chunk.shape[1],samples-offset)
                            if n>0:audio[:,offset:offset+n]=chunk[:,:n];offset+=n
                        if offset>=samples:break
        return (frames,count,{'sample_rate':48000,'waveform':torch.from_numpy(audio).unsqueeze(0)})


class ComfyLabTrimClip:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'images':('IMAGE',),'audio':('AUDIO',),'duration':('FLOAT',{'min':0.4,'max':86400,'default':2}),'fps':('INT',{'min':24,'max':24,'default':24})}}
    RETURN_TYPES=('IMAGE','AUDIO')
    FUNCTION='trim'
    CATEGORY='Comfy Lab/video'

    def trim(self,images,audio,duration,fps):
        count=math.ceil(duration*fps-1e-6)
        return images[:count],{**audio,'waveform':audio['waveform'][...,:round(duration*audio['sample_rate'])]}
