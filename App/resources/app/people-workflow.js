'use strict';

const defaultPrompt = 'Photorealistic people in an architectural photograph, natural human anatomy, realistic faces and hands, detailed natural skin and fabric, coherent lighting and shadows. Preserve the existing number of people, their pose, position, clothing colours and scale.';

function checkedPeople(raw) {
  const ranges = {peopleConfidence:[0.05,0.95,0.35],peopleDenoise:[0.05,0.85,0.4],peopleControl:[0,1,0.6],peopleMaskExpansion:[0,32,4],peopleFeather:[0,32,8],peopleCropFactor:[1,4,2],peopleGuideSize:[512,1024,768],peopleCfg:[1,10,5]};
  const settings = {};
  for (const [key,[min,max,fallback]] of Object.entries(ranges)) {
    const value = Number(raw[key] ?? fallback);
    if (!Number.isFinite(value) || value < min || value > max) throw Error('Invalid people setting: '+key);
    settings[key] = ['peopleMaskExpansion','peopleFeather','peopleGuideSize'].includes(key) ? Math.round(value) : value;
  }
  settings.peopleSam = raw.peopleSam !== false;
  settings.peopleNegative = String(raw.peopleNegative ?? 'illustration, cartoon, plastic skin, malformed hands, extra limbs, duplicate people').slice(0,2000);
  if(raw.peopleSelectedIds!==undefined){
    if(!Array.isArray(raw.peopleSelectedIds)||raw.peopleSelectedIds.some(id=>typeof id!=='string'||!/^person-\d+$/.test(id)))throw Error('Invalid person selection');
    settings.peopleSelectedIds=[...new Set(raw.peopleSelectedIds)];
  }
  settings.peopleMaskEdited=raw.peopleMaskEdited===true;
  return settings;
}

function buildPeople(image, raw, preview = false) {
  const s = {...raw,...checkedPeople(raw)};
  const graph = {
    '1': {class_type:'LoadImage',inputs:{image}},
    '2': {class_type:'UltralyticsDetectorProvider',inputs:{model_name:'segm/person_yolov8m-seg.pt'}},
    '4': {class_type:'ImpactSimpleDetectorSEGS',inputs:{bbox_detector:['2',0],image:['1',0],bbox_threshold:s.peopleConfidence,bbox_dilation:0,crop_factor:s.peopleCropFactor,drop_size:8,sub_threshold:s.peopleSam?0.93:s.peopleConfidence,sub_dilation:0,sub_bbox_expansion:0,sam_mask_hint_threshold:0.7,post_dilation:s.peopleMaskExpansion}},
    '5': {class_type:'ImpactSEGSLabelFilter',inputs:{segs:['4',0],preset:'all',labels:'person'}},
    '6': {class_type:'SegsToCombinedMask',inputs:{segs:['5',0]}},
    '7': {class_type:'MaskToImage',inputs:{mask:['6',0]}},
    '32': {class_type:'ImpactCount_Elts_in_SEGS',inputs:{segs:['5',0]}},
    '33': {class_type:'PreviewAny',inputs:{source:['32',0]}}
  };
  if(s.peopleSam) {
    graph['3']={class_type:'SAMLoader',inputs:{model_name:'sam_vit_b_01ec64.pth',device_mode:'AUTO'}};
    graph['4'].inputs.sam_model_opt=['3',0];
  } else graph['4'].inputs.segm_detector_opt=['2',1];
  if(preview) {
    graph['36']={class_type:'ComfyLabPeopleMasks',inputs:{segs:['5',0]}};
    graph['18']={class_type:'SaveImage',inputs:{images:['7',0],filename_prefix:'Comfy Lab/masks/people'}};
    return graph;
  }
  let finalMask=['6',0];
  if(s.peopleMaskInput){
    for(const id of ['2','3','4','5','6'])delete graph[id];
    graph['40']={class_type:'LoadImageMask',inputs:{image:s.peopleMaskInput,channel:'red'}};
    graph['5']={class_type:'MaskToSEGS',inputs:{mask:['40',0],combined:false,crop_factor:s.peopleCropFactor,bbox_fill:false,drop_size:1,contour_fill:false}};
    graph['7'].inputs.mask=['40',0];
    finalMask=['40',0];
  }
  graph['8']={class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:'Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors'}};
  graph['9']={class_type:'CLIPTextEncode',inputs:{clip:['8',1],text:String(s.prompt||'').trim()||defaultPrompt}};
  graph['10']={class_type:'CLIPTextEncode',inputs:{clip:['8',1],text:s.peopleNegative}};
  let segs=['5',0];
  if(s.peopleControl>0) {
    graph['12']={class_type:'ControlNetLoader',inputs:{control_net_name:'xinsir-tile-sdxl-1.0.safetensors'}};
    graph['13']={class_type:'ImpactControlNetApplyAdvancedSEGS',inputs:{segs,control_net:['12',0],strength:s.peopleControl,start_percent:0,end_percent:0.75,control_image:['1',0]}};
    segs=['13',0];
  }
  graph['14']={class_type:'DetailerForEach',inputs:{image:['1',0],segs,model:['8',0],clip:['8',1],vae:['8',2],guide_size:s.peopleGuideSize,guide_size_for:true,max_size:1024,seed:s.seed,steps:s.steps,cfg:s.peopleCfg,sampler_name:'dpmpp_2m',scheduler:'karras',positive:['9',0],negative:['10',0],denoise:s.peopleDenoise,feather:s.peopleFeather,noise_mask:true,force_inpaint:true,wildcard:'',cycle:1,inpaint_model:false,noise_mask_feather:8,tiled_encode:false,tiled_decode:false}};
  // Constrain every change to the same silhouette mask shown in the preview.
  graph['15']={class_type:'ImageCompositeMasked',inputs:{destination:['1',0],source:['14',0],x:0,y:0,resize_source:false,mask:finalMask}};
  graph['18']={class_type:'SaveImage',inputs:{images:['15',0],filename_prefix:'Comfy Lab/people'}};
  graph['34']={class_type:'SaveImage',inputs:{images:['7',0],filename_prefix:'Comfy Lab/masks/people'}};
  return graph;
}

module.exports={buildPeople,checkedPeople,defaultPrompt};
