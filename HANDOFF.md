# HANDOFF — Kids Tutor

> อัปเดตล่าสุด 2026-07-08: รอบนี้เพิ่ม UX/management/progress/super-admin แล้ว โค้ดยังไม่ได้ commit เพราะเครื่อง agent สร้าง `.git/index.lock` ไม่ได้ (`Permission denied`) ต้องให้ผู้ใช้รัน git เอง

## ล่าสุดมากกว่า (2026-07-08 รอบ product hardening)

ผู้ใช้สั่ง "งาน product ต่อไปที่น่าทำ do it all" แล้วทำเพิ่มใน working tree:

- หน้า `/parent/exercises`
  - เพิ่ม sort mode: เรียงตามวิชา, ล่าสุดก่อน, ชื่อ ก-ฮ, สถานะ
  - เพิ่ม pagination ฝั่ง client หน้า 20 รายการต่อหน้า
  - ยังคง group ตามวิชาและ summary เด็กเล็ก/เด็กโต
  - เปลี่ยนปุ่มลบเป็น "เก็บเข้าคลัง" เพื่อ archive ชุดแทน hard-delete
- API `DELETE /api/parent/exercise-sets/:id`
  - เปลี่ยนจาก hard-delete เป็นตั้ง `exercise_sets.status = 'archived'`
  - clear `share_token`
  - เด็กจะไม่เห็นเพราะ play query รับเฉพาะ `published`
- หน้า `/parent/admin`
  - summary นับแบบฝึกหัดทุกสถานะ และเพิ่มตัวเลขชุดที่เก็บเข้าคลัง
  - หน้า cleanup แสดง archived sets ด้วย เพื่อให้ลบถาวรได้และคืน storage/database usage จริง
- หน้า `/play/exercises`
  - เพิ่ม dashboard แยกตามวิชา บอกทำแล้ว/ทั้งหมด/เหลือกี่ชุด
  - รายการแบบฝึกหัดถูก group ตามวิชา
- หน้า `/play/progress` และ `/parent/children/:id/progress`
  - เพิ่ม progress ต่อวิชาแบบชุดที่ทำครบแล้ว/ชุดทั้งหมด/เหลือกี่ชุด
  - ไม่ใช้ average score เป็น metric หลัก
- `worker/lib/progress.ts`
  - เพิ่ม `completedSetCount` และ `remainingSetCount` ใน subject progress
- หน้า `/super-admin`
  - เพิ่มค้นหาบัญชีด้วย email/id
  - ก่อนลบบัญชีต้องพิมพ์ email ให้ตรงใน dialog
- API `DELETE /api/super-admin/parents/:id`
  - backend ต้องได้รับ `{ confirmEmail }` และต้องตรงกับ email ใน DB ก่อนลบจริง
  - ถ้าไม่ตรงตอบ `400 confirmation_required`
- tests
  - เพิ่ม test ว่า super-admin delete ต้องมี token และ confirm email ตรงกันก่อนลบ

ตรวจแล้วหลังรอบนี้:

- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

ไฟล์ที่เปลี่ยนในรอบนี้:

- `HANDOFF.md`
- `shared/types.ts`
- `src/routes/SuperAdmin.tsx`
- `src/routes/parent/Admin.tsx`
- `src/routes/parent/ChildProgress.tsx`
- `src/routes/parent/ExerciseList.tsx`
- `src/routes/play/PlayExerciseList.tsx`
- `src/routes/play/PlayProgress.tsx`
- `src/styles.css`
- `tests/run-tests.mjs`
- `worker/lib/progress.ts`
- `worker/routes/admin.ts`
- `worker/routes/exercises.ts`
- `worker/routes/super-admin.ts`

คำสั่ง commit/push สำหรับรอบนี้:

```powershell
git add HANDOFF.md shared\types.ts src\routes\SuperAdmin.tsx src\routes\parent\Admin.tsx src\routes\parent\ChildProgress.tsx src\routes\parent\ExerciseList.tsx src\routes\play\PlayExerciseList.tsx src\routes\play\PlayProgress.tsx src\styles.css tests\run-tests.mjs worker\lib\progress.ts worker\routes\admin.ts worker\routes\exercises.ts worker\routes\super-admin.ts
git commit -m "Harden product management and progress UX"
git push origin main
```

## ล่าสุดมาก (2026-07-08)

งานที่ทำแล้วใน working tree:

- เปลี่ยนข้อความหน้าแรกจาก "ระบบติวแบบฝึกหัดสำหรับเด็ก" เป็น "ระบบทำแบบฝึกหัดสำหรับเด็ก"
- เปลี่ยนคำใน UI จาก "ลูก/ลูกๆ" เป็น "เด็ก" ในจุดที่เป็น user-facing หลัก
- ปรับ UI หลายหน้าให้สะอาดขึ้นด้วย Radix theme และปรับหน้า review/play ให้สี feedback อ่านชัดขึ้น
- หน้าเล่นแบบฝึกหัดของเด็กมีลิงก์ดูความคืบหน้า และหน้า `/play/progress`
- หน้า progress ของผู้ปกครองและเด็กเลิกเน้น average score แล้วแสดง progress แยกตามวิชา
- หน้า management แบบฝึกหัดจัดกลุ่มตาม `วิชา` และมีสรุปจำนวนชุดตาม `เด็กเล็ก` / `เด็กโต`
- เพิ่ม admin ภายในบัญชีเดิมสำหรับดู usage และ cleanup ข้อมูลบัญชีนั้น
- เพิ่ม super-admin ข้ามบัญชีที่ `/super-admin`
  - API: `/api/super-admin/summary`
  - API: `DELETE /api/super-admin/parents/:id`
  - ป้องกันด้วย header `x-super-admin-token` เทียบกับ Worker secret `SUPER_ADMIN_TOKEN`
  - ใช้สำหรับดูทุกบัญชี, จำนวนเด็ก, แบบฝึกหัด, คำถาม, attempts, R2 objects/bytes และลบบัญชีเพื่อ cleanup storage/database

ไฟล์ที่เปลี่ยนในรอบล่าสุด:

- `shared/types.ts`
- `src/App.tsx`
- `src/routes/SuperAdmin.tsx` (ใหม่)
- `src/routes/parent/Admin.tsx`
- `src/routes/parent/ChildProgress.tsx`
- `src/routes/parent/ExerciseList.tsx`
- `src/routes/play/PlayProgress.tsx`
- `src/styles.css`
- `worker/env.ts`
- `worker/index.ts`
- `worker/lib/progress.ts`
- `worker/routes/super-admin.ts` (ใหม่)

ตรวจแล้ว:

- `npm.cmd test` ผ่าน 11/11
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

ก่อนใช้ super-admin บน production ต้องตั้ง secret:

```powershell
cd "D:\Session limit\kids-tutor"
$env:WRANGLER_WRITE_LOGS='false'
npx wrangler secret put SUPER_ADMIN_TOKEN
```

แล้วเข้า `https://kids-tutor.nupark.workers.dev/super-admin` และกรอก token เดียวกัน

คำสั่ง commit/push ที่ผู้ใช้ต้องรันเอง:

```powershell
git add shared\types.ts src\App.tsx src\routes\SuperAdmin.tsx src\routes\parent\Admin.tsx src\routes\parent\ChildProgress.tsx src\routes\parent\ExerciseList.tsx src\routes\play\PlayProgress.tsx src\styles.css worker\env.ts worker\index.ts worker\lib\progress.ts worker\routes\super-admin.ts HANDOFF.md
git commit -m "Add subject progress grouping and super admin"
git push origin main
```

Next step หลัง push:

- รอดู GitHub Actions deploy
- ตั้ง `SUPER_ADMIN_TOKEN` ใน Cloudflare Workers ถ้ายังไม่ได้ตั้ง
- Smoke test production:
  - `/parent/exercises` ดู grouping/summarize ตามวิชา
  - `/parent/children/:id/progress` ดู progress ตามวิชา
  - `/play/progress` ดู progress ฝั่งเด็ก
  - `/super-admin` ดู summary ข้ามบัญชีและทดสอบ token

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
| `ordering` | ✅ ใช้งานได้ + ทดสอบ production แล้ว | drag-drop UI + ปุ่มเลื่อนขึ้น/ลงสำหรับทัช, grading เทียบ array |

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

## 4.1 งานล่าสุด (2026-07-07 รอบ 2): ช่องทาง AI ingest (push)

เพิ่ม "endpoint สาธารณะให้ AI ตัวไหนก็ส่งแบบฝึกหัดเข้าระบบเองได้" ต่อยอดจาก `GET /contract` เดิม

- **`POST /api/ingest/:token`** (public, `worker/routes/ingest.ts`) — AI/agent ที่ถือ ingest token ของ parent POST JSON (`{title, questions}`) เข้ามาตรงๆ ไม่ต้องแนบรูป → สร้าง exercise_set สถานะ `pending_review` ของ parent นั้น (คงด่านอนุมัติมนุษย์ไว้ ไม่เผยแพร่อัตโนมัติ). รับ `?ageBand=young|older&subject=ชื่อวิชา`. มี cap ขนาด body 512KB + จำนวนข้อ 200. reuse `parseImportedJson` (repair/validate เดียวกับ paste flow)
- **`/api/parent/ingest-token`** (parent-guarded, `worker/routes/ingest-token.ts`) — GET ดู / POST สร้าง-หมุน / DELETE ยกเลิก token
- **`worker/lib/exercise-sets.ts`** (ใหม่) — ย้าย `insertDraftQuestions` ออกจาก exercises.ts มาไว้ที่นี่ (ใช้ร่วม upload + ingest) + `resolveSubjectId` (map วิชาตามชื่อ)
- **migration `0009_ingest_token.sql`** — `parents.ingest_token` + unique index. **รัน `--remote` แล้ว** และตรวจ schema remote แล้วว่ามี column/index ครบ
- **contract.ts** — เพิ่มหัวข้อ "ช่องทางส่งเข้าระบบเอง (push/ingest)" ใน markdown (CONTRACT_VERSION คงเดิม = 3 เพราะ schema โจทย์ไม่เปลี่ยน เป็นแค่ช่องทางส่งใหม่)
- **UI**: การ์ด "ให้ AI ส่งเข้าระบบเอง" ใน `src/routes/parent/Upload.tsx` — สร้าง/หมุน/ยกเลิก token + คัดลอกลิงก์ ingest (ลิงก์อิง ageBand/subject ที่เลือกในฟอร์มอัตโนมัติ)
- build (`tsc -b && vite build`) ผ่านแล้ว และ deploy production แล้ว

## 4.2 งานล่าสุด (2026-07-07 รอบ 3): ปิด TODO สำคัญ

- รัน migration 0009 บน remote D1 แล้ว (`parents.ingest_token` + `idx_parents_ingest_token`)
- deploy production ล่าสุดสำเร็จ: **version `8029aad4-0ebe-4219-8aab-85a3696111ab`**
- ผู้ใช้ทดสอบ production ingest + ordering จริงแล้ว: สร้าง token → POST `/api/ingest/:token` → ชุดโผล่ใน "รอตรวจ" → approve/publish/assign/play แล้ว **OK**
- ปิด stack trace leak ที่ `worker/routes/exercises.ts` โดยเอา `details: stack` ออกจาก 500 response แต่ยัง `console.error` ไว้
- เพิ่มปุ่ม `↑` / `↓` ใน `QuestionOrdering` เพื่อให้เด็กใช้บนมือถือ/แท็บเล็ตได้ แม้ drag-drop จะไม่สะดวก
- แก้ `worker/routes/questions.ts` ให้ parent-side add/edit question รองรับ `fraction` และ `ordering` ด้วย (เดิมยัง validate แค่ 4 type เก่า)
- แก้ upload flow แบบ JSON-only/no image ที่เคยแตก `Cannot read properties of undefined (reading 'r2Key')`: ถ้าไม่มีรูปจะเก็บ `source_image_r2_key = ''`, ไม่ batch insert รูป, และตอนลบชุดโจทย์จะไม่ลบ R2 key ว่าง
- ตรวจ production smoke test แล้ว: `/api/health` = 200, `/contract` = 200, `/api/ingest/bad-token-for-test` = 401

หมายเหตุ Wrangler: ใน sandbox นี้ Wrangler อาจล้มเพราะเขียน log ไป `C:\Users\nupar\AppData\Roaming\xdg.config\.wrangler\logs` ไม่ได้ ให้ตั้ง `$env:WRANGLER_WRITE_LOGS='false'` ก่อน deploy ถ้าเจอ error เรื่อง log file

## 5. งานค้าง / ควรทำต่อ (TODO)

### สำคัญ (ควรทำก่อน)
0. ✅ **รัน migration 0009 + deploy ให้ ingest ใช้งานได้จริง** — เสร็จแล้วและทดสอบ production แล้ว
1. ✅ **ทดสอบ ordering type จริง** — ผู้ใช้ทดสอบ production แล้ว OK
2. ✅ **ปิด stack trace บน production** — เอา `details: stack` ออกจาก response แล้ว

### สำคัญถัดไป
3. **Push commit รอบ ingest/order fixes** — commit local แล้ว ให้ push ขึ้น GitHub เมื่อพร้อม
4. ✅ **เพิ่ม validation เชิง schema ของแต่ละ question type** — เพิ่มแล้วใน `worker/lib/json-import.ts` และ reuse กับ upload/ingest, manual add/edit question, Pi extraction result
5. **เพิ่ม unit tests ให้ `gradeAnswer()` และ import validation** — อย่างน้อย `fraction` ลดทอนได้, `ordering` ถูก/ผิดตาม array, และ invalid payload ต้อง reject ด้วยข้อความชัดเจน

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
│   ├── lib/exercise-sets.ts # insertDraftQuestions() + resolveSubjectId() (ใช้ร่วม upload+ingest)
│   ├── routes/ingest.ts   # POST /api/ingest/:token (public AI push)
│   ├── routes/ingest-token.ts # จัดการ token ของ parent
│   └── routes/exercises.ts # POST / (upload), merge, GET รายละเอียด
├── src/
│   ├── lib/RichText.tsx   # แปลง slash fraction → stacked (ใหม่)
│   ├── lib/AnswerKey.tsx  # แสดงเฉลย read-only ทุก type
│   ├── routes/play/Player.tsx           # SimplePlayer (เด็กเล็ก) + OlderPlayer (เด็กโต)
│   ├── routes/play/components/Question*.tsx  # UI ตอบแต่ละ type
│   └── routes/parent/    # ReviewExercise, TeacherView, StudentWorksheet, Upload
└── db/migrations/        # 0001..0009 (0008 = fraction/ordering CHECK, 0009 = parents.ingest_token รัน --remote แล้ว)
```

ดูเพิ่ม: `README.md` (setup), `DESIGN.md` (design system/tokens), `shared/contract.ts` (กติกา AI แกะโจทย์)
