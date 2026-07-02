import os
import re

import pytesseract
from PIL import Image, ImageOps

pytesseract.pytesseract.tesseract_cmd = os.environ.get("TESSERACT_CMD", "tesseract")

_BIB_MIN_DIGITS = int(os.environ.get("BIB_MIN_DIGITS", 2))
_BIB_MAX_DIGITS = int(os.environ.get("BIB_MAX_DIGITS", 5))
_MIN_CONFIDENCE = float(os.environ.get("OCR_MIN_CONFIDENCE", 0.6))
_MAX_DIMENSION = 1600

_BIB_PATTERN = re.compile(rf"^\d{{{_BIB_MIN_DIGITS},{_BIB_MAX_DIGITS}}}$")
_TESSERACT_CONFIG = "--psm 11 -c tessedit_char_whitelist=0123456789"


def _preprocess(image: Image.Image) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    contrasted = ImageOps.autocontrast(grayscale)
    if max(contrasted.size) <= _MAX_DIMENSION:
        return contrasted
    ratio = _MAX_DIMENSION / max(contrasted.size)
    new_size = (int(contrasted.width * ratio), int(contrasted.height * ratio))
    return contrasted.resize(new_size, Image.LANCZOS)


def _extract_candidates(image: Image.Image) -> list[dict]:
    processed = _preprocess(image)
    data = pytesseract.image_to_data(
        processed, config=_TESSERACT_CONFIG, output_type=pytesseract.Output.DICT
    )

    candidates = []
    for text, conf in zip(data["text"], data["conf"]):
        text = text.strip()
        if not _BIB_PATTERN.match(text):
            continue
        candidates.append({"bib_number": int(text), "confidence": max(float(conf), 0) / 100})
    return candidates


def extract_bib_number(image: Image.Image) -> dict | None:
    candidates = [c for c in _extract_candidates(image) if c["confidence"] >= _MIN_CONFIDENCE]
    if not candidates:
        return None
    return max(candidates, key=lambda c: c["confidence"])
