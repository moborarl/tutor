# HANDOFF — Kids Tutor

เอกสารส่งต่อสำหรับ session ถัดไป อัปเดตล่าสุด: 2026-07-07

---

## 1. ภาพรวมโปรเจกต์

แพลตฟอร์มติวแบบฝึกหัดสำหรับเด็ก บน **Cloudflare Workers + D1 + R2** (ไม่มี API เสียเงินเลย)

- ผู้ปกครองอัปโหลดรูปแบบฝึกหัด + วาง JSON (ที่ได้จาก AI ฟรีภายนอก เช่น Gemini/ChatGPT/Claude web) → ระบบสร้างชุดโจทย์ดิจิทัล
- เด็กเข้าเล่นผ่านโปรไฟล์ + PIN 4 หลัก มี UI แยกตามวัย (เด็กเล็ก `young` / เด็กโต `older`)
- ระบบตรวจคำตอบฝั่งเซิร์ฟเวอร์ + ล็อกคำตอบ (ตอบซ้ำไม่ได้) + ติดตามความคืบหน้า
- ผู้ปกครองตรวจ/อนุมัติทีละข้อก่อนเผยแพร่ พิมพ์ฉบับเฉลย + ฉบับนักเรียนได้
- แชร์ชุดโจทย์ข้ามบัญชีผู้ปกครองผ่านลิงก์

### Stack
- **Frontend:** React + TypeScript + Vite + React Router (`src/`)
- **Backend:** Hono บน Cloudflare Workers (`worker/`)
- **DB:** Cloudflare D1 (SQLite) — schema ที่ `db/migrations/`
- **Storage:** Cloudflare R2 (`WORKSHEETS` bucket) เก็บรูปต้นฉบับ
- **Shared:** `shared/` = types + contract + diagram/json-repair helpers (ใช้ทั้ง worker และ src)
- **Pi fallback:** `pi-extraction/` = บริการแกะโจทย์บน Raspberry Pi เมื่อ cloud AI quota หมด

### URL / Deploy
- Production: **https://kids-tutor.nupark.workers.dev**
- GitHub: **https://github.com/moborarl/tutor.git** (branch `main`)
- มี domain เก่า `tutor.yourpower.today` แต่เป็น version เก่า — **ใช้ `kids-tutor.nupark.workers.dev` เท่านั้น**

---

## 2. คำสั่งที่ใช้บ่อย

```bash
# ต้องอยู่ใน D:\Session limit\kids-tutor
npm run build           # build ทั้ง client + worker
npm run deploy          # build + deploy ขึ้น Cloudflare
npm run dev             # dev server local

# D1 migration (ใช้ npx เพราะ wrangler ไม่ได้ติดตั้ง global)
npx wrangler d1 execute kids-tutor-db --file db/migrations/XXXX.sql --remote
# ^ ต้องมี --remote เสมอ ไม่งั้นจะรันบน local DB ที่ว่างเปล่า

# ข้อมูล D1
#   database name: kids-tutor-db
#   database id:   0d3bfd62-ce4f-4ed7-89ff-d70fcc62cd1a
```

**Environment:** Windows 11 + PowerShell. wrangler ต้องเรียกผ่าน `npx`

---

## 3. ประเภทโจทย์ (question types) — สถานะ

CONTRACT_VERSION ปัจจุบัน = **3** (`shared/contract.ts`)

| Type | สถานะ | หมายเหตุ |
|------|-------|---------|
| `multiple_choice` | ✅ ใช้งานได้ | |
| `fill_blank` | ✅ ใช้งานได้ | grading ทน whitespace/comma ต่างกัน |
| `matching` | ✅ ใช้งานได้ | |
| `true_false` | ✅ ใช้งานได้ | |
| `fraction` | ✅ ใช้งานได้ + ทดสอบแล้ว | เด็กกรอกตัวเศษ/ตัวส่วน, grading ยอมรับรูปลดทอน (2/4 = 1/2) |
| `ordering` | ⚠️ **สร้างครบแต่ยังไม่ทดสอบจริง** | drag-drop UI, grading เทียบ array — ยังไม่มีใครอัปโหลด/เล่นจริง |

### การเพิ่ม question type ใหม่ ต้องแตะ 6 จุด (checklist)
1. `shared/types.ts` — เพิ่มใน `QuestionType` union + interface Content/Answer
2. `shared/contract.ts` — เพิ่มตัวอย่างใน PROMPT_TEMPLATE + bump CONTRACT_VERSION + changelog
3. `worker/lib/grading.ts` — เพิ่ม case ใน `gradeAnswer()`
4. `worker/lib/json-import.ts` — เพิ่มใน `VALID_TYPES` **(ถ้าลืมจะได้ error `invalid_questions_json`)**
5. **`db/migrations/` — migration ใหม่แก้ CHECK constraint ของ `question_type`** แล้วรันด้วย `--remote` **(ถ้าลืมจะได้ 500 `D1_ERROR: CHECK constraint failed`)**
6. Frontend — สร้าง `src/routes/play/components/QuestionXxx.tsx` + wire ใน `Player.tsx` (2 จุด: SimplePlayer + QuestionBody), เพิ่มใน `TYPE_TH` (`ReviewExercise.tsx`), `AnswerKey.tsx`, `StudentWorksheet.tsx`

> บทเรียนจาก session นี้: จุดที่ 4 และ 5 คือจุดที่ลืมบ่อยที่สุด และ error message ไม่ชัดถ้าไม่ได้ดู Network Response

---

## 4. งานที่ทำใน session ล่าสุด (2026-07-07)

Phase 3 = fraction + ordering + printable worksheet. Commits:
- `aa1f134` Phase 3a: fraction type + student printable worksheet
- `932e120` Phase 3b: ordering type + drag-drop UI
- `c6a2c7b` Fix: เพิ่ม fraction/ordering ใน `VALID_TYPES` (json-import)
- `4da2a01` Fix: เปลี่ยน batch insert เป็น sequential (error ชัดขึ้น)
- `bd928d3` เพิ่ม try-catch + error logging ที่ POST /exercise-sets
- `7c148fc` Migration 0008: เพิ่ม fraction/ordering ใน CHECK constraint (รัน --remote แล้ว)
- `414f4e5` Fix: AnswerKey แสดง fraction แบบ stacked
- `b2a01ab` เพิ่ม `RichText`: แปลง `\d+/\d+` ใน prompt เป็นเศษส่วนซ้อนอัตโนมัติ

### จุดสำคัญ: `RichText` (`src/lib/RichText.tsx`)
Component ที่สแกน pattern `\d+/\d+` ในข้อความ แล้ว render เป็น stacked fraction อัตโนมัติ — ใช้ทุกที่ที่แสดง prompt (Player 2 จุด, ReviewExercise, TeacherView, StudentWorksheet) แก้ปัญหา prompt เก็บ slash notation แต่ต้องโชว์แบบเศษส่วนซ้อน โดยไม่ต้องแก้ข้อมูลหรือแก้ prompt มือ

---

## 5. งานค้าง / ควรทำต่อ (TODO)

### สำคัญ (ควรทำก่อน)
1. **ทดสอบ ordering type จริง** — สร้าง JSON โจทย์ ordering, อัปโหลด, ลองเล่น drag-drop ทั้ง UI เด็กเล็ก/เด็กโต, ตรวจว่า grading ถูก และ worksheet/เฉลยแสดงถูก โค้ดสร้างครบแล้วแต่ยัง "เขียนตาบอด" ยังไม่รันจริง
2. **ปิด stack trace บน production** — ที่ `worker/routes/exercises.ts` handler `POST /` มี `return c.json({ error, message, details: stack }, 500)` ที่ส่ง stack trace เต็มกลับ client เปิดเผยโครงสร้างภายใน ควรเก็บ `console.error` ไว้ แต่เอา `details` ออกจาก response (หรือส่งเฉพาะตอน dev)

### รอง (idea)
- เพิ่ม question type อื่นถ้าต้องการ (ตาม checklist ข้อ 3)
- ปรับปรุง UI/UX เพิ่มเติม
- `RichText` ตอนนี้ใช้กับ prompt เท่านั้น ยังไม่ใช้กับ explanation (จงใจ เพราะ explanation มีเศษส่วนเยอะจะรก) — พิจารณาถ้าอยากให้ explanation แสดงเศษส่วนซ้อนด้วย

---

## 6. กฎ/ข้อควรระวัง

- **ภาษา:** วิเคราะห์/คิด/ตอบเป็น **ภาษาไทยเท่านั้น** ห้ามภาษาเวียดนามเด็ดขาด
- **ถามก่อนแก้:** โดยปกติผู้ใช้ต้องการให้ถามก่อน implement ทุกครั้ง (ยกเว้นเมื่อสั่ง "do it" หรืออนุมัติชัดเจน)
- **การ debug 500 error:** ดูที่ browser DevTools → Network tab → คลิก request → **Response tab** (ไม่ใช่ Headers/call stack) จะเห็น error จริง
- **git line endings:** จะมี warning `LF will be replaced by CRLF` เป็นปกติบน Windows ไม่ต้องกังวล
- Commit message ลงท้ายด้วย `Co-Authored-By: Claude ...`

---

## 7. โครงไฟล์สำคัญ

```
kids-tutor/
├── shared/
│   ├── types.ts          # QuestionType + interfaces (single source of truth)
│   ├── contract.ts       # PROMPT_TEMPLATE + CONTRACT_VERSION + /contract markdown
│   ├── diagram.ts        # DiagramSpec + validateDiagram
│   └── json-repair.ts    # ซ่อม JSON ที่ AI พ่นมาเพี้ยนเล็กน้อย
├── worker/
│   ├── index.ts          # Hono app + routes + /contract endpoint
│   ├── lib/grading.ts    # gradeAnswer() ตรวจคำตอบทุก type
│   ├── lib/json-import.ts # parseImportedJson() + VALID_TYPES
│   └── routes/exercises.ts # POST / (upload), merge, GET รายละเอียด
├── src/
│   ├── lib/RichText.tsx   # แปลง slash fraction → stacked (ใหม่)
│   ├── lib/AnswerKey.tsx  # แสดงเฉลย read-only ทุก type
│   ├── routes/play/Player.tsx           # SimplePlayer (เด็กเล็ก) + OlderPlayer (เด็กโต)
│   ├── routes/play/components/Question*.tsx  # UI ตอบแต่ละ type
│   └── routes/parent/    # ReviewExercise, TeacherView, StudentWorksheet, Upload
└── db/migrations/        # 0001..0008 (0008 = fraction/ordering CHECK)
```

ดูเพิ่ม: `README.md` (setup), `DESIGN.md` (design system/tokens), `shared/contract.ts` (กติกา AI แกะโจทย์)
