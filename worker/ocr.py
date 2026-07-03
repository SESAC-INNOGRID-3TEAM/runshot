import os
import re

import pytesseract
from PIL import Image, ImageOps

pytesseract.pytesseract.tesseract_cmd = os.environ.get("TESSERACT_CMD", "tesseract")

_BIB_MIN_DIGITS = int(os.environ.get("BIB_MIN_DIGITS", 2))
_BIB_MAX_DIGITS = int(os.environ.get("BIB_MAX_DIGITS", 5))
_MIN_CONFIDENCE = float(os.environ.get("OCR_MIN_CONFIDENCE", 0.6))
_MAX_DIMENSION = 1600
_MAX_DETECTION_BOXES = 15
_CROP_PADDING_RATIO = 0.12
_CROP_UPSCALE_FACTOR = 3.0
_CROP_MAX_HEIGHT = 900
_DEDUP_IOU_THRESHOLD = 0.5

_BIB_PATTERN = re.compile(rf"^\d{{{_BIB_MIN_DIGITS},{_BIB_MAX_DIGITS}}}$")
_DETECT_CONFIGS = ("--psm 3", "--psm 4", "--psm 6", "--psm 11", "--psm 12")
_CROP_CONFIGS = (
    "--psm 7 -c tessedit_char_whitelist=0123456789",
    "--psm 8 -c tessedit_char_whitelist=0123456789",
    "--psm 6 -c tessedit_char_whitelist=0123456789",
)


def _preprocess(image: Image.Image) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    contrasted = ImageOps.autocontrast(grayscale)
    if max(contrasted.size) <= _MAX_DIMENSION:
        return contrasted
    ratio = _MAX_DIMENSION / max(contrasted.size)
    new_size = (int(contrasted.width * ratio), int(contrasted.height * ratio))
    return contrasted.resize(new_size, Image.LANCZOS)


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    intersection = ix * iy
    union = aw * ah + bw * bh - intersection
    return intersection / union if union > 0 else 0.0


def _detect_text_boxes(processed: Image.Image) -> list[tuple[int, int, int, int]]:
    """1차 패스: 전체 사진에서 텍스트로 보이는 영역의 위치만 찾는다.
    이 단계의 글자 인식 결과(무엇이라고 읽었는지)는 신뢰하지 않고 위치(bounding box)만 사용한다.

    사진마다 레이아웃이 달라서(정형적인 배번판 vs 자연스러운 스냅샷) 레이아웃 분석 모드(PSM)
    하나로는 배번호 영역 자체를 못 찾는 경우가 있어, 여러 PSM으로 각각 찾은 뒤 겹치는 후보를
    합쳐서 씀. 배번호는 사진 안에서 큰 텍스트 블록인 경우가 많아 면적 큰 순으로 정렬한다."""
    all_boxes: list[tuple[int, int, int, int]] = []
    for config in _DETECT_CONFIGS:
        data = pytesseract.image_to_data(processed, config=config, output_type=pytesseract.Output.DICT)
        all_boxes.extend(
            (data["left"][i], data["top"][i], data["width"][i], data["height"][i])
            for i, text in enumerate(data["text"])
            if text.strip()
        )

    all_boxes.sort(key=lambda b: b[2] * b[3], reverse=True)

    deduped: list[tuple[int, int, int, int]] = []
    for box in all_boxes:
        if any(_iou(box, kept) > _DEDUP_IOU_THRESHOLD for kept in deduped):
            continue
        deduped.append(box)
        if len(deduped) >= _MAX_DETECTION_BOXES:
            break
    return deduped


def _crop_region(image: Image.Image, box: tuple[int, int, int, int], scale: float) -> Image.Image:
    """1차 패스 좌표(축소된 이미지 기준)를 원본 이미지 좌표로 환산해 여유 있게 잘라내고,
    작은 숫자도 잘 읽히도록 일정 높이 이상으로 확대한다."""
    left, top, width, height = (v / scale for v in box)
    pad_x, pad_y = width * _CROP_PADDING_RATIO, height * _CROP_PADDING_RATIO
    crop_box = (
        max(0, int(left - pad_x)),
        max(0, int(top - pad_y)),
        min(image.width, int(left + width + pad_x)),
        min(image.height, int(top + height + pad_y)),
    )
    crop = image.crop(crop_box)
    if crop.height == 0:
        return crop
    upscale = max(1.0, min(_CROP_UPSCALE_FACTOR, _CROP_MAX_HEIGHT / crop.height))
    if upscale > 1.0:
        crop = crop.resize((int(crop.width * upscale), int(crop.height * upscale)), Image.LANCZOS)
    return crop


def _best_digits_in_crop(crop: Image.Image) -> dict | None:
    """2차 패스: 잘라서 확대한 영역 하나에 여러 PSM(레이아웃 분석 모드)으로 숫자만 정밀 재인식.

    Tesseract가 스스로 보고하는 confidence는 whitelist 제한 때문에 왜곡되어, 정답을
    맞히고도 0에 가까운 값을 내는 경우가 있어 그대로 신뢰할 수 없다. 대신 여러 PSM이
    같은 숫자로 일치하는지를 주 근거로 삼고, tesseract 자체 confidence는 보조 지표로만 쓴다.
    """
    votes: dict[int, list[float]] = {}
    for config in _CROP_CONFIGS:
        data = pytesseract.image_to_data(crop, config=config, output_type=pytesseract.Output.DICT)
        for text, conf in zip(data["text"], data["conf"]):
            text = text.strip()
            if not _BIB_PATTERN.match(text):
                continue
            votes.setdefault(int(text), []).append(max(float(conf), 0) / 100)

    if not votes:
        return None

    bib_number, raw_confidences = max(votes.items(), key=lambda kv: (len(kv[1]), sum(kv[1])))
    agreement = len(raw_confidences) / len(_CROP_CONFIGS)
    raw_avg = sum(raw_confidences) / len(raw_confidences)
    confidence = max(raw_avg, 0.5 + 0.5 * agreement)
    return {"bib_number": bib_number, "confidence": confidence}


def extract_bib_number(image: Image.Image) -> dict | None:
    rgb_image = image.convert("RGB")
    processed = _preprocess(rgb_image)
    scale = processed.width / rgb_image.width

    boxes = _detect_text_boxes(processed)
    if not boxes:
        return None
    max_area = max(w * h for _, _, w, h in boxes)

    candidates = []
    for box in boxes:
        crop = _crop_region(rgb_image, box, scale)
        result = _best_digits_in_crop(crop)
        if not result:
            continue
        # 아주 작은 영역이 여러 PSM에서 우연히 만장일치로 틀리는 경우(예: 얇은 텍스트 조각이
        # "11"처럼 단순한 모양으로 잘못 읽히며 confidence 1.0이 나옴)가 실제로 있어서,
        # 가장 큰 후보 영역 대비 크기 비율로 confidence를 보정한다 — 배번호는 사진에서
        # 가장 눈에 띄는(큰) 텍스트인 경우가 많다는 전제.
        _, _, width, height = box
        size_weight = 0.5 + 0.5 * (width * height) / max_area
        result["confidence"] *= size_weight
        candidates.append(result)

    valid = [c for c in candidates if c["confidence"] >= _MIN_CONFIDENCE]
    if not valid:
        return None
    return max(valid, key=lambda c: c["confidence"])
