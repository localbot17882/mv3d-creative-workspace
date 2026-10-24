"""Local PCM WAV output for Comfy Lab's text-to-audio workflow."""
import wave
from pathlib import Path
import numpy as np
import folder_paths

class ComfyLabSaveAudioWAV:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'audio': ('AUDIO',), 'filename_prefix': ('STRING', {'default': 'Comfy Lab/Audio/ltx25'})}}
    RETURN_TYPES=()
    FUNCTION='save'
    OUTPUT_NODE=True
    CATEGORY='Comfy Lab/audio'

    def save(self,audio,filename_prefix):
        folder,name,counter,subfolder,_=folder_paths.get_save_image_path(filename_prefix,folder_paths.get_output_directory())
        rate=int(audio['sample_rate'])
        if rate<8000 or rate>192000:raise ValueError('Unsupported sample rate')
        results=[]
        for waveform in audio['waveform']:
            samples=waveform.detach().float().cpu().numpy()
            if samples.ndim!=2 or not 1<=samples.shape[0]<=8:raise ValueError('Invalid audio channels')
            pcm=(np.clip(np.nan_to_num(samples),-1,1).T*32767).astype('<i2')
            filename=f'{name}_{counter:05}_.wav'
            with wave.open(str(Path(folder)/filename),'wb') as out:
                out.setnchannels(samples.shape[0]);out.setsampwidth(2);out.setframerate(rate);out.writeframes(pcm.tobytes())
            results.append({'filename':filename,'subfolder':subfolder,'type':'output'})
            counter+=1
        return {'ui':{'audio':results}}
