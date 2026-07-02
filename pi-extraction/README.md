# Pi Extraction Service

บริการแกะโจทย์สำรองที่รันบน Raspberry Pi 5 — ทำงานเฉพาะตอนที่โควตา AI cloud (Claude) หมด
งานจะเข้าคิวสถานะ `processing` บน Cloudflare แล้ว Pi จะ poll มาหยิบไปทำเอง (outbound เท่านั้น ไม่ต้องเปิด port)

## Pipeline

1. Poll `GET /api/internal/pending-extractions` ทุก ~20 วินาที
2. ดึงรูปจาก Worker → **OCR** ด้วย Tesseract (ไทย+อังกฤษ) — ภาพนิ่ง 1 รูปใช้เวลา ~1-2 วินาทีบน Pi 5
3. ส่งข้อความดิบเข้า **Ollama** (โมเดลข้อความล้วน ค่าเริ่มต้น `qwen2.5:3b` รันบน CPU+RAM ของบอร์ด)
   ให้จัดโครงสร้างเป็นโจทย์+เฉลย JSON
4. `POST /api/internal/extraction-result` ส่งผลกลับ

หมายเหตุ: pipeline นี้ไม่สร้างโจทย์แบบ matching (ข้อความ OCR ไม่มี layout เส้นโยง)
และชิป Hailo AI HAT (ถ้ามี) ไม่ช่วยเร่ง Ollama — LLM รันบน CPU เสมอ

## ติดตั้งบน Pi (ครั้งแรก)

```bash
# 1. ติดตั้ง Docker (ถ้ายังไม่มี)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # แล้ว logout/login ใหม่

# 2. clone repo แล้วเข้าโฟลเดอร์นี้
cd kids-tutor/pi-extraction

# 3. ตั้งค่า
cp .env.example .env
nano .env   # ใส่ API_BASE_URL และ PI_WORKER_TOKEN (ต้องตรงกับ secret ฝั่ง Cloudflare)

# 4. รัน
docker compose up -d --build

# 5. ดึงโมเดล (ครั้งแรกครั้งเดียว ~2GB)
docker exec ollama ollama pull qwen2.5:3b

# 6. ดู log
docker compose logs -f extraction-service
```

`restart: unless-stopped` ทำให้ service รันอัตโนมัติตอนบูตเครื่องและเด้งกลับเองถ้า crash

## ทดสอบว่า fallback ทำงาน

1. ตั้ง `ANTHROPIC_API_KEY` ฝั่ง Cloudflare ให้ผิด (หรือปล่อยว่าง)
2. อัปโหลดรูปแบบฝึกหัดในเว็บ → สถานะจะเป็น "รอคิว Pi"
3. ภายใน ~20 วินาที Pi จะหยิบงาน → ดู log ได้ด้วย `docker compose logs -f`
4. เมื่อเสร็จ หน้าเว็บจะขึ้น "รอตรวจ" พร้อมป้าย "แกะโดย Raspberry Pi"

## เปลี่ยนโมเดล

ถ้าคุณภาพไม่พอ ลองโมเดลใหญ่ขึ้น (ช้าลง):

```bash
docker exec ollama ollama pull llama3.2:3b   # หรือโมเดลอื่น
# แก้ OLLAMA_MODEL ใน .env แล้ว docker compose up -d
```
