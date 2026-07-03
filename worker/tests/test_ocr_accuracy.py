"""
sample_photos/ 폴더의 사진으로 ocr.py의 배번호 인식 정확도를 확인하는 로컬 스크립트.
DB, MinIO, RabbitMQ 전혀 사용하지 않음 - ocr.extract_bib_number()만 단독 호출.

파일명 규칙: "<정답배번호>_<구분자>.<확장자>" 예) 1234_01.jpg
사용법: worker/ 디렉토리에서 python3 tests/test_ocr_accuracy.py
"""

import sys
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

load_dotenv()

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ocr import extract_bib_number

SAMPLE_DIR = Path(__file__).resolve().parent / "sample_photos"


def expected_bib_number(filename: str) -> int:
    return int(filename.split("_")[0])


def main() -> None:
    photo_paths = sorted(
        p for p in SAMPLE_DIR.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )

    if not photo_paths:
        print(f"{SAMPLE_DIR} 에 테스트할 사진이 없습니다.")
        return

    correct = 0
    results = []

    for path in photo_paths:
        expected = expected_bib_number(path.name)
        image = Image.open(path)
        candidate = extract_bib_number(image)

        got = candidate["bib_number"] if candidate else None
        confidence = candidate["confidence"] if candidate else 0.0
        is_correct = got == expected
        correct += is_correct

        results.append((path.name, expected, got, confidence, is_correct))

    print(f"{'파일명':<20} {'정답':>6} {'인식결과':>8} {'confidence':>10}  결과")
    print("-" * 60)
    for name, expected, got, confidence, is_correct in results:
        mark = "OK" if is_correct else "FAIL"
        print(f"{name:<20} {expected:>6} {str(got):>8} {confidence:>10.2f}  {mark}")

    total = len(results)
    print("-" * 60)
    print(f"정확도: {correct}/{total} ({correct / total:.0%})")


if __name__ == "__main__":
    main()
