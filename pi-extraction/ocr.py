"""OCR step: one still image -> raw text, using Tesseract (Thai + English)."""

import io

import pytesseract
from PIL import Image, ImageOps


def ocr_image(image_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(image_bytes))
    # Basic cleanup that helps photographed worksheets: respect EXIF rotation,
    # grayscale, and upscale small photos for better character recognition.
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")
    if max(img.size) < 1500:
        scale = 1500 / max(img.size)
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    return pytesseract.image_to_string(img, lang="tha+eng")
