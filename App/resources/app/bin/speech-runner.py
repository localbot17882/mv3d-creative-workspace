import sys,os,json
from pathlib import Path
root=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(root/'Data/speech-runtime'))
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
import torch,numpy as np,soundfile as sf
from qwen_tts import Qwen3TTSModel
config=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
torch.manual_seed(int(config['seed']))
model_path=root/'ComfyUI/models/Qwen3-TTS'/('Qwen3-TTS-12Hz-0.6B-Base' if config['mode']=='clone' else 'Qwen3-TTS-12Hz-0.6B-CustomVoice')
model=Qwen3TTSModel.from_pretrained(str(model_path),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa',local_files_only=True)
kwargs=dict(text=config['text'],language=config['language'],max_new_tokens=8192)
if config['mode']=='clone':
    kwargs.update(ref_audio=config['reference'],x_vector_only_mode=not bool(config['reference_text'].strip()))
    if config['reference_text'].strip():kwargs['ref_text']=config['reference_text']
    waves,rate=model.generate_voice_clone(**kwargs)
else:waves,rate=model.generate_custom_voice(speaker=config['voice'],**kwargs)
wave=np.asarray(waves[0],dtype=np.float32)
if config['speed']!=1:
    import av
    graph=av.filter.Graph();source=graph.add_abuffer(sample_rate=rate,format='fltp',layout='mono',time_base=__import__('fractions').Fraction(1,rate));tempo=graph.add('atempo',str(config['speed']));sink=graph.add('abuffersink');source.link_to(tempo);tempo.link_to(sink);graph.configure();frame=av.AudioFrame.from_ndarray(wave.reshape(1,-1),format='fltp',layout='mono');frame.sample_rate=rate;frame.pts=0;source.push(frame);source.push(None);chunks=[]
    while True:
        try:chunks.append(sink.pull().to_ndarray().reshape(-1))
        except (av.error.EOFError,av.error.BlockingIOError):break
    if chunks:wave=np.concatenate(chunks)
sf.write(config['output'],wave,rate,subtype='PCM_16')
print(json.dumps({'sample_rate':rate,'duration':len(wave)/rate}))
