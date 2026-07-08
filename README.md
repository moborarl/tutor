# Kids Tutor 📚

ระบบทำแบบฝึกหัดสำหรับเด็กในครอบครัว — อัปโหลดรูปถ่ายแบบฝึกหัด ให้ AI แกะโจทย์+เฉลย
ผู้ปกครองตรวจ/แก้/อนุมัติ แล้วมอบหมายให้เด็กทำบน iPad พร้อมติดตาม progress รายคน

## สถาปัตยกรรม

- **Cloudflare Worker เดียว** (Hono) เสิร์ฟทั้ง API และ React SPA ผ่าน static assets binding
- **D1** (SQLite) เก็บข้อมูลทั้งหมด, **R2** เก็บรูปถ่ายแบบฝึกหัด
- **AI แกะโจทย์แบบ fallback chain**: Claude API (หลัก) → cloud สำรอง (ถ้าตั้งค่า) → Raspberry Pi 5
  รัน OCR+Ollama ในบ้าน (ดู [pi-extraction/](pi-extraction/README.md)) เมื่อโควตา cloud หมด
- เด็กเข้าใช้โดยเลือกโปรไฟล์ + PIN 4 หลัก ภายใต้ session ผู้ปกครองบน iPad ที่ใช้ร่วมกัน
- UI เด็กเล็ก (`young`) ปุ่มใหญ่/ข้อความน้อยกว่า UI เด็กโต (`older`) อัตโนมัติ

## Dev local

```bash
npm install
npx wrangler d1 migrations apply DB --local
cp .dev.vars.example .dev.vars   # แล้วใส่ ANTHROPIC_API_KEY ถ้าต้องการทดสอบ AI จริง
npm run dev                       # Vite + workerd จริง (D1/R2 local emulation)
```

## Deploy ครั้งแรก

```bash
# 1. สร้าง D1 database และ R2 bucket
npx wrangler d1 create kids-tutor-db      # เอา database_id ไปใส่ใน wrangler.jsonc
npx wrangler r2 bucket create kids-tutor-worksheets

# 2. ตั้ง secrets
npx wrangler secret put SESSION_SECRET     # สุ่ม string ยาวๆ
npx wrangler secret put ANTHROPIC_API_KEY  # จาก console.anthropic.com
npx wrangler secret put PI_WORKER_TOKEN    # สุ่ม string ยาวๆ (ใช้ค่าเดียวกันบน Pi)

# 3. migrate + deploy
npm run db:migrate:remote
npm run deploy
```

## Deploy อัตโนมัติผ่าน GitHub

ตั้ง repo secret ชื่อ `CLOUDFLARE_API_TOKEN` (สร้างจาก Cloudflare dashboard → API Tokens
→ template "Edit Cloudflare Workers" + เพิ่มสิทธิ์ D1) แล้ว push ขึ้น `main`
— workflow จะ typecheck → build → migrate → deploy ให้เอง

## โครงสร้าง

```
worker/          Hono API (auth, children, exercises, questions, play, progress, internal)
src/             React SPA (/parent/* ผู้ปกครอง, /play/* เด็ก)
shared/types.ts  TypeScript types ใช้ร่วมกัน
db/migrations/   D1 schema
pi-extraction/   บริการแกะโจทย์สำรองบน Raspberry Pi (Docker)
```
