"""Queue-safe adapter to the isolated, official Qwen3-TTS runtime."""
import json,os,subprocess,tempfile,wave,time
from pathlib import Path
import torch,numpy as np,folder_paths,comfy.model_management as mm
class ComfyLabSpeech:
    @classmethod
    def INPUT_TYPES(cls):return {'required':{'text':('STRING',{'multiline':True}),'voice':(['Ryan','Aiden','Vivian','Serena','Dylan','Eric','Ono_Anna','Sohee','Uncle_Fu'],),'language':(['Auto','English','Spanish','French','German','Italian','Portuguese','Chinese','Japanese','Korean','Russian'],),'mode':(['preset','clone'],),'speed':('FLOAT',{'default':1,'min':0.75,'max':1.5}),'seed':('INT',{'default':42,'min':0,'max':4294967295}),'reference':('STRING',{'default':''}),'reference_text':('STRING',{'default':'','multiline':True})}}
    RETURN_TYPES=('AUDIO',);FUNCTION='generate';CATEGORY='Comfy Lab/audio'
    def generate(self,text,voice,language,mode,speed,seed,reference,reference_text):
        if not text.strip() or len(text)>1500 or len(text.split())>240:raise ValueError('Use a short narration segment, up to 240 words.')
        root=Path(__file__).resolve().parents[3]
        ref=''
        if mode=='clone':
            if not reference or Path(reference).name!=reference:raise ValueError('Choose a voice reference from the app.')
            ref=str(Path(folder_paths.get_input_directory())/reference)
            if not Path(ref).is_file():raise ValueError('The voice reference is unavailable.')
        mm.unload_all_models();mm.soft_empty_cache()
        with tempfile.TemporaryDirectory(dir=root/'Data') as temp:
            temp=Path(temp);config=temp/'speech.json';out=temp/'speech.wav';config.write_text(json.dumps(dict(text=text,voice=voice,language=language,mode=mode,speed=speed,seed=seed,reference=ref,reference_text=reference_text,output=str(out))),encoding='utf-8')
            env={**os.environ,'HF_HOME':str(root/'Data/huggingface'),'PYTHONPATH':str(root/'Data/speech-runtime')}
            log=temp/'runtime.log'
            with log.open('w',encoding='utf-8') as output:
                process=subprocess.Popen([str(root/'.venv/Scripts/python.exe'),str(root/'App/resources/app/bin/speech-runner.py'),str(config)],stdout=output,stderr=subprocess.STDOUT,env=env,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
                started=time.monotonic()
                try:
                    while process.poll() is None:
                        mm.throw_exception_if_processing_interrupted()
                        if time.monotonic()-started>900:raise TimeoutError('Speech generation exceeded 15 minutes.')
                        time.sleep(0.25)
                except BaseException:
                    process.terminate()
                    try:process.wait(timeout=5)
                    except subprocess.TimeoutExpired:process.kill();process.wait()
                    raise
            if process.returncode:raise RuntimeError('Speech generation failed: '+log.read_text(encoding='utf-8',errors='replace')[-1800:])
            with wave.open(str(out)) as w:rate=w.getframerate();channels=w.getnchannels();samples=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32).reshape(-1,channels).T/32768
        return ({'waveform':torch.from_numpy(samples.copy()).unsqueeze(0),'sample_rate':rate},)
NODE_CLASS_MAPPINGS={'ComfyLabSpeech':ComfyLabSpeech}
NODE_DISPLAY_NAME_MAPPINGS={'ComfyLabSpeech':'Comfy Lab · Speech and Voice Clone'}
