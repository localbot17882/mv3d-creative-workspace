import base64
import io

import numpy as np
from PIL import Image


class ComfyLabPeopleMasks:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"segs": ("SEGS",)}}

    RETURN_TYPES = ()
    FUNCTION = "preview"
    OUTPUT_NODE = True
    CATEGORY = "Comfy Lab/People"

    def preview(self, segs):
        height, width = segs[0]
        people = []
        ordered = sorted(segs[1], key=lambda seg: (seg.bbox[0], seg.bbox[1]))
        for index, seg in enumerate(ordered, start=1):
            mask = np.asarray(seg.cropped_mask)
            if mask.ndim == 3:
                mask = mask[0]
            pixels = (np.clip(mask, 0, 1) * 255).astype(np.uint8)
            buffer = io.BytesIO()
            Image.fromarray(pixels).save(buffer, format="PNG")
            people.append({
                "id": f"person-{index}",
                "bbox": [int(value) for value in seg.bbox],
                "crop": [int(value) for value in seg.crop_region],
                "confidence": float(np.asarray(seg.confidence).item()),
                "mask": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
            })
        return {"ui": {"people": [{"width": width, "height": height, "items": people}]}, "result": ()}


NODE_CLASS_MAPPINGS = {"ComfyLabPeopleMasks": ComfyLabPeopleMasks}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyLabPeopleMasks": "Comfy Lab Person Masks"}
