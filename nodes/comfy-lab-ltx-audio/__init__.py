from . import audio_only
from .nodes_registry import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from .save_wav import ComfyLabSaveAudioWAV
NODE_CLASS_MAPPINGS['ComfyLabSaveAudioWAV']=ComfyLabSaveAudioWAV
NODE_DISPLAY_NAME_MAPPINGS['ComfyLabSaveAudioWAV']='Comfy Lab · Save WAV'
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
from . import iclora, tiled_fusion_sampler
from .load_clip import ComfyLabLoadClip,ComfyLabTrimClip
NODE_CLASS_MAPPINGS['ComfyLabLoadClip']=ComfyLabLoadClip

NODE_CLASS_MAPPINGS['ComfyLabTrimClip']=ComfyLabTrimClip
