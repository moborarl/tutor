"""Polling extraction service for kids-tutor, running on a Raspberry Pi.

Loop: poll the Worker for pending extraction jobs -> download the worksheet
photo -> OCR it locally -> ask a local Ollama text model to structure the
raw text into questions -> POST the result back to the Worker.

This service only makes outbound HTTPS requests; it never listens on a port.
"""

import json
import logging
import os
import re
import time

import requests

from ocr import ocr_image

API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
PI_WORKER_TOKEN = os.environ["PI_WORKER_TOKEN"]
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "20"))

HEADERS = {"Authorization": f"Bearer {PI_WORKER_TOKEN}"}
VALID_TYPES = {"multiple_choice", "fill_blank", "matching", "true_false"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("extraction")


STRUCTURING_PROMPT = """คุณคือระบบแปลงข้อความจากแบบฝึกหัดให้เป็น JSON
ข้อความต่อไปนี้ได้จากการ OCR รูปถ่ายแบบฝึกหัดของเด็ก{age_note}
จงแยกเป็นรายการโจทย์ พร้อมสร้างเฉลยที่ถูกต้องให้แต่ละข้อ

ตอบเป็น JSON เท่านั้น ตาม schema นี้ (ห้ามมีข้อความอื่นนอก JSON):
{{
  "title": "ชื่อชุดแบบฝึกหัดสั้นๆ",
  "questions": [
    {{"questionType": "multiple_choice", "prompt": "โจทย์", "content": {{"options": ["ก","ข","ค"]}}, "answer": {{"correctIndex": 0}}}},
    {{"questionType": "true_false", "prompt": "ประโยค", "content": {{}}, "answer": {{"value": true}}}},
    {{"questionType": "fill_blank", "prompt": "ประโยคที่มี ___ ตรงช่องว่าง", "content": {{}}, "answer": {{"answers": ["คำตอบ"]}}}}
  ]
}}

questionType ต้องเป็นหนึ่งใน: multiple_choice, fill_blank, true_false
(อย่าใช้ matching เพราะข้อความ OCR ไม่มีข้อมูล layout เส้นโยง)

ข้อความจาก OCR:
---
{ocr_text}
---"""


def parse_model_json(raw: str):
    """Extract the first JSON object from model output (tolerates ```json fences)."""
    raw = raw.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        raw = fence.group(1)
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in model output")
    return json.loads(raw[start : end + 1])


def structure_with_ollama(ocr_text: str, age_band: str):
    age_note = " (เด็กเล็ก ให้โจทย์สั้นและง่าย)" if age_band == "young" else ""
    prompt = STRUCTURING_PROMPT.format(age_note=age_note, ocr_text=ocr_text[:6000])
    res = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 2048},
            "format": "json",
        },
        timeout=600,  # CPU inference on a Pi can be slow; this is an async queue
    )
    res.raise_for_status()
    data = parse_model_json(res.json()["response"])

    questions = []
    for q in data.get("questions", []):
        if (
            isinstance(q, dict)
            and q.get("questionType") in VALID_TYPES
            and isinstance(q.get("prompt"), str)
            and q["prompt"].strip()
        ):
            questions.append(
                {
                    "questionType": q["questionType"],
                    "prompt": q["prompt"].strip(),
                    "content": q.get("content") or {},
                    "answer": q.get("answer") or {},
                }
            )
    return data.get("title") or "", questions


def process_job(job):
    set_id = job["exerciseSetId"]
    log.info("processing exercise set %s", set_id)
    try:
        img = requests.get(
            f"{API_BASE_URL}/api/internal/exercise-sets/{set_id}/image",
            headers=HEADERS,
            timeout=60,
        )
        img.raise_for_status()

        text = ocr_image(img.content)
        log.info("ocr got %d chars", len(text))
        if len(text.strip()) < 5:
            raise ValueError("OCR produced no usable text")

        title, questions = structure_with_ollama(text, job.get("ageBand", "older"))
        if not questions:
            raise ValueError("model produced no valid questions")

        payload = {"exerciseSetId": set_id, "title": title, "questions": questions}
        log.info("posting %d questions", len(questions))
    except Exception as e:  # noqa: BLE001 - report any failure back to the Worker
        log.exception("extraction failed for set %s", set_id)
        payload = {"exerciseSetId": set_id, "error": f"pi extraction failed: {e}"}

    res = requests.post(
        f"{API_BASE_URL}/api/internal/extraction-result",
        headers={**HEADERS, "content-type": "application/json"},
        json=payload,
        timeout=60,
    )
    log.info("result posted: %s %s", res.status_code, res.text[:200])


def main():
    log.info("extraction service starting; api=%s model=%s", API_BASE_URL, OLLAMA_MODEL)
    # Re-queue jobs stuck in 'extracting' from a previous crash of this service.
    try:
        r = requests.post(
            f"{API_BASE_URL}/api/internal/requeue-stale", headers=HEADERS, timeout=30
        )
        log.info("requeue-stale: %s", r.text[:200])
    except Exception:
        log.warning("requeue-stale failed (continuing)")

    while True:
        try:
            res = requests.get(
                f"{API_BASE_URL}/api/internal/pending-extractions",
                headers=HEADERS,
                timeout=30,
            )
            res.raise_for_status()
            jobs = res.json()
            for job in jobs:
                process_job(job)
        except Exception:
            log.exception("poll cycle failed; will retry")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
