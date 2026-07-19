# HANDOFF — Kids Tutor

## Design note จากผู้ใช้ (สำคัญ)

- หลีกเลี่ยงการออกแบบแบบ “สีเดียวกันซ้อนกัน” โดยเฉพาะ **ข้อความสีเขียว หรือ progress bar สีเขียว บนพื้นหลังสีเขียว** เพราะอ่านยากและดูไม่ชัด
- ถ้าใช้พื้นหลังเขียว/olive/sage แล้ว ข้อความควรเป็นสีขาวหรือสีเข้มที่ contrast สูงตามพื้นหลัง
- ถ้า progress bar เป็นสีเขียว ควรวางบนพื้นอ่อน/neutral track ไม่ใช่บน card เขียวเข้ม
- ก่อนจบงาน UI ให้เช็ก hover/active/selected state เสมอ เพราะ state เหล่านี้มักทำให้ contrast ต่ำโดยไม่ตั้งใจ
- หลีกเลี่ยงการใช้ action text หรือ secondary text สีเขียวหม่นบนการ์ดสีเขียว/olive เพราะจะกลืนกับพื้นหลังง่ายมาก
- Tree item ชั้นย่อยต้องเช็กสีข้อความและไอคอนแยกจาก item หลักเสมอ โดยเฉพาะใน state ปกติและ hover

## Implementation ล่าสุด (2026-07-08 รอบ explorer/theme)

ทำแล้วใน working tree รอบนี้:

1. หน้า `ดูแลข้อมูล > แบบฝึกหัด`
   - checkbox เล็กลงและไม่กินพื้นที่ row (`compact-checkbox`)
   - column ชื่อวิชา/ชื่อแบบฝึกหัดกว้างขึ้น
   - เอาปุ่ม `ลบ` รายแถวออก ใช้เฉพาะ `ลบที่เลือก` ด้านบน
   - ปรับ row เป็น grid ชัดเจน ลดอาการบีบ

2. Theme เป็น earth tone green
   - ลดสีส้มแรง
   - ใช้ sage/olive green เป็น primary accent
   - พื้นหลังเป็นเขียวเทาอ่อน, card เป็น off-white เขียวอ่อน, border เป็นเขียวเทา
   - left tree เป็น green soft/professional
   - คงสี correct/wrong/delete ให้ชัด
   - คง print page เป็นขาวสำหรับพิมพ์

3. หน้า `แบบฝึกหัด` เป็น 2-pane tree จริง
   - ซ้าย: `วิชา > เด็กเล็ก/เด็กโต > แบบฝึกหัด`
   - ขวา:
     - เลือกวิชา = summary วิชานั้น
     - เลือกเด็กเล็ก/เด็กโต = list แบบฝึกหัดในกลุ่มนั้น
     - เลือกแบบฝึกหัด = รายละเอียด + ปุ่มแก้ไข/ตรวจ/เผยแพร่/เก็บเข้าคลัง

4. หน้า `เด็ก` เป็น 2-pane tree pattern
   - ซ้าย: `สมาชิกครอบครัว > เด็ก > ความคืบหน้า / แบบฝึกหัดที่มอบหมาย / ตั้งค่าโปรไฟล์`
   - ขวา:
     - progress by subject
     - assigned exercises
     - edit/delete child profile

5. Design system เล็ก ๆ เพื่อใช้ซ้ำ
   - เพิ่ม `src/components/ChildAvatar.tsx`: แทน emoji ล้วนด้วย avatar ในกรอบ consistent + tone สีประจำเด็ก
   - avatar picker เป็น grid ในหน้าเพิ่ม/แก้เด็ก
   - เพิ่ม `src/components/TreePanel.tsx` สำหรับ tree navigation ซ้าย
   - เพิ่ม `src/components/ExplorerLayout.tsx` สำหรับ layout ซ้าย tree + ขวา workspace
   - ใช้ซ้ำในแบบฝึกหัด management และ children management แล้ว

ตรวจแล้ว:
- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน

> อัปเดตล่าสุด 2026-07-08: รอบนี้เพิ่ม UX/management/progress/super-admin แล้ว โค้ดยังไม่ได้ commit เพราะเครื่อง agent สร้าง `.git/index.lock` ไม่ได้ (`Permission denied`) ต้องให้ผู้ใช้รัน git เอง

## ล่าสุดที่สุด (2026-07-08 รอบ polish)

ผู้ใช้สั่ง "งาน polish do it all" แล้วทำเพิ่มใน working tree:

- เพิ่ม loading/empty/error state ที่ดูเป็นระบบเดียวกัน
  - หน้าเด็กเลือกโปรไฟล์
  - หน้าเด็กดูรายการแบบฝึกหัด
  - หน้าเด็กกำลังเปิดแบบฝึกหัด
  - หน้าเด็กดูความคืบหน้า
  - หน้า parent แบบฝึกหัด
  - หน้า parent progress/admin
- ปรับ mobile/responsive ของหน้าเด็ก
  - topbar หน้าเด็กไม่เบียดบนจอเล็ก
  - การ์ดแบบฝึกหัดเด็กใช้ขนาดคงที่ขึ้น
  - PIN pad เล็กลงเล็กน้อยบน mobile
- ปรับ wording ให้เป็นภาษาไทยมากขึ้น
  - `Admin` ใน nav เปลี่ยนเป็น `ดูแลข้อมูล`
  - heading หน้า admin เปลี่ยนเป็น `ดูแลข้อมูล`
  - `Cleanup` เปลี่ยนเป็น `ล้างข้อมูล`
  - `attempts`/`storage` ใน UI หลักเปลี่ยนเป็น `ประวัติการทำ`/`พื้นที่ไฟล์`
- เพิ่ม CSS class กลาง:
  - `.state-card`, `.state-spinner`, `.empty-state`, `.error-state`
  - `.kid-topbar`, `.kid-exercise-list`, `.kid-exercise-card`
  - `.centered-play`, `.kid-page-title`, `.pin-avatar`

ตรวจแล้วหลังรอบ polish:

- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

ไฟล์ที่เปลี่ยนในรอบ polish:

- `HANDOFF.md`
- `src/routes/SuperAdmin.tsx`
- `src/routes/parent/Admin.tsx`
- `src/routes/parent/ChildProgress.tsx`
- `src/routes/parent/ExerciseList.tsx`
- `src/routes/parent/ParentLayout.tsx`
- `src/routes/play/PlayExerciseList.tsx`
- `src/routes/play/PlayProgress.tsx`
- `src/routes/play/Player.tsx`
- `src/routes/play/ProfilePicker.tsx`
- `src/styles.css`

คำสั่ง commit/push รอบ polish:

```powershell
git add HANDOFF.md src\routes\SuperAdmin.tsx src\routes\parent\Admin.tsx src\routes\parent\ChildProgress.tsx src\routes\parent\ExerciseList.tsx src\routes\parent\ParentLayout.tsx src\routes\play\PlayExerciseList.tsx src\routes\play\PlayProgress.tsx src\routes\play\Player.tsx src\routes\play\ProfilePicker.tsx src\styles.css
git commit -m "Polish loading states and responsive UI"
git push origin main
```

## ล่าสุดที่สุดอีก (2026-07-08 รอบ R2 file manager)

ผู้ใช้ถามว่า "ทำให้ manage ไฟล์ R2 โดยตรงได้ไหม" แล้วเพิ่มใน working tree:

- เพิ่ม API parent สำหรับจัดการไฟล์ R2 ในบัญชีตัวเอง
  - `GET /api/parent/admin/r2-files`
    - list เฉพาะ prefix `worksheets/{parentId}/`
    - คืน `{ files, cursor }`
    - page size 50
  - `DELETE /api/parent/admin/r2-files`
    - body `{ key, confirmKey }`
    - ต้อง key อยู่ใต้ `worksheets/{parentId}/`
    - ต้อง confirmKey ตรงกับ key ก่อนลบ
- เพิ่ม API super-admin สำหรับจัดการไฟล์ R2 ข้ามบัญชี
  - `GET /api/super-admin/r2-files?prefix=...&cursor=...`
    - list ได้ทั้ง bucket หรือกรอง prefix
    - page size 100
  - `DELETE /api/super-admin/r2-files`
    - body `{ key, confirmKey }`
    - ต้อง confirmKey ตรงกับ key ก่อนลบ
- เพิ่ม UI หน้า `/parent/admin`
  - section `ไฟล์ R2`
  - โหลดรายการ/รีเฟรช/โหลดเพิ่ม
  - แสดง key, size, uploaded time
  - ลบทีละไฟล์โดยต้องพิมพ์ key ยืนยัน
- เพิ่ม UI หน้า `/super-admin`
  - section `ไฟล์ R2`
  - ช่อง prefix เช่น `worksheets/123/`
  - list/delete แบบข้ามบัญชี
- ขยาย `src/lib/api-client.ts` ให้ `api.delete(path, body?)` ส่ง JSON body ได้
- เพิ่ม CSS `.r2-file-row` และ `.r2-file-key` เพื่อให้ key ยาวไม่ดัน layout แตก

ข้อควรระวัง:

- การลบไฟล์ R2 โดยตรงไม่ลบ row ใน D1
- ถ้าไฟล์ยังถูกอ้างโดย `exercise_sets.source_image_r2_key` หรือ `exercise_images.r2_key` รูปในแบบฝึกหัดจะหาย
- ใช้สำหรับ cleanup ไฟล์ที่มั่นใจว่าไม่ใช้แล้ว หรือแก้ storage ที่ค้าง

ตรวจแล้ว:

- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

ไฟล์ที่เปลี่ยนในรอบนี้:

- `HANDOFF.md`
- `src/lib/api-client.ts`
- `src/routes/SuperAdmin.tsx`
- `src/routes/parent/Admin.tsx`
- `src/styles.css`
- `worker/routes/admin.ts`
- `worker/routes/super-admin.ts`

คำสั่ง commit/push รอบนี้:

```powershell
git add HANDOFF.md src\lib\api-client.ts src\routes\SuperAdmin.tsx src\routes\parent\Admin.tsx src\styles.css worker\routes\admin.ts worker\routes\super-admin.ts
git commit -m "Add direct R2 file management"
git push origin main
```

## ล่าสุดที่สุดเพิ่ม (2026-07-08 รอบสลับ parent/play)

ผู้ใช้เสนอว่าควรมี link/channel สำหรับสลับ parent กับ play แล้วทำเพิ่ม:

- หน้า parent nav (`src/routes/parent/ParentLayout.tsx`)
  - เพิ่ม link `โหมดเด็ก` ไป `/play`
- หน้าเลือกเด็ก (`src/routes/play/ProfilePicker.tsx`)
  - เพิ่มปุ่ม `ผู้ปกครอง` ไป `/parent/exercises`
  - หน้าใส่ PIN มี action bar ที่มี `เลือกใหม่` และ `ผู้ปกครอง`
- หน้าเด็กดูรายการแบบฝึกหัด (`src/routes/play/PlayExerciseList.tsx`)
  - เพิ่มปุ่ม `ผู้ปกครอง` ใน topbar
- หน้าเด็กดูความคืบหน้า (`src/routes/play/PlayProgress.tsx`)
  - เพิ่มปุ่ม `ผู้ปกครอง`
- CSS (`src/styles.css`)
  - เพิ่ม `.mode-switch-link`, `.parent-mode-link`, `.play-mode-actions`
  - ปรับ `.kid-topbar` ให้รองรับปุ่มเพิ่มบน desktop/mobile

ตรวจแล้ว:

- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

ถ้า commit รวมกับรอบ R2 ให้ใช้คำสั่ง:

```powershell
git add HANDOFF.md src\lib\api-client.ts src\routes\SuperAdmin.tsx src\routes\parent\Admin.tsx src\routes\parent\ParentLayout.tsx src\routes\play\PlayExerciseList.tsx src\routes\play\PlayProgress.tsx src\routes\play\ProfilePicker.tsx src\styles.css worker\routes\admin.ts worker\routes\super-admin.ts
git commit -m "Add R2 file management and mode switching"
git push origin main
```

## ล่าสุดที่สุดเพิ่มอีก (2026-07-08 รอบ family profile/password)

ผู้ใช้ขอให้มี home page สำหรับแต่ละครอบครัว หรือมีชื่อครอบครัวเป็น profile และให้เปลี่ยนรหัสผ่านผู้ปกครองได้ แล้วทำเพิ่ม:

- เพิ่ม migration `db/migrations/0010_parent_profile.sql`
  - `ALTER TABLE parents ADD COLUMN family_name TEXT`
- เพิ่ม backend route `worker/routes/profile.ts`
  - `GET /api/parent/profile`
    - คืน email, familyName, counts, children summary
    - ถ้า familyName ยังว่าง จะ fallback จาก email เป็น `{local-part} family`
  - `PATCH /api/parent/profile`
    - แก้ชื่อครอบครัว
  - `POST /api/parent/profile/password`
    - เปลี่ยนรหัสผ่านผู้ปกครอง
    - ต้องส่ง currentPassword ถูกต้อง
    - newPassword ต้องอย่างน้อย 8 ตัวและไม่ซ้ำรหัสเดิม
- เพิ่ม route เข้า worker:
  - `parent.route('/profile', profileRoutes)`
- ปรับ signup:
  - รับ `familyName`
  - หน้า signup มีช่องชื่อครอบครัว
  - หลังสมัครไปหน้า `/parent`
- เพิ่มหน้า `src/routes/parent/FamilyHome.tsx`
  - `/parent` เป็นหน้า home ครอบครัวแล้ว ไม่ redirect ไป `/parent/exercises`
  - แสดงชื่อครอบครัว, email, stats สรุป, รายชื่อเด็กสั้น ๆ
  - แก้ชื่อครอบครัวได้
  - เปลี่ยนรหัสผ่านผู้ปกครองได้
  - มีปุ่มไปสร้างแบบฝึกหัดและโหมดเด็ก
- ปรับ nav:
  - เพิ่ม `ครอบครัว`
  - brand `Kids Tutor` link ไป `/parent`
- เพิ่ม CSS:
  - `.family-hero`, `.family-grid`, `.stack-form`, `.family-child-list`, `.family-child-row`

ตรวจแล้ว:

- `npm.cmd test` ผ่าน 12/12
- `$env:WRANGLER_WRITE_LOGS='false'; npm.cmd run build` ผ่าน
- `git diff --check` ผ่าน มีแค่ warning LF/CRLF ปกติบน Windows

คำสั่ง commit/push รอบนี้:

```powershell
git add HANDOFF.md db\migrations\0010_parent_profile.sql src\App.tsx src\routes\parent\FamilyHome.tsx src\routes\parent\ParentLayout.tsx src\routes\parent\Signup.tsx src\styles.css worker\index.ts worker\routes\auth.ts worker\routes\profile.ts
git commit -m "Add family profile home and password change"
git push origin main
```

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

## 4.3 งานล่าสุด (2026-07-08 รอบ 4): เอา hardcoded domain ออกจาก prompt template

ผู้ใช้ถามว่ามีการแก้ Cloudflare Pages URL / ไฟล์ตั้งค่า deployment หรือไม่ → **ไม่มีการแก้ `wrangler.jsonc` เลย** แต่ตรวจเจอปัญหาอื่นแทน:

- **โปรเจกต์นี้ไม่ใช่ Cloudflare Pages** — เป็น **Workers + Static Assets** (`assets.binding: ASSETS` ใน `wrangler.jsonc`) ไม่มี `_routes.json` / `.pages.yml`. URL `kids-tutor.nupark.workers.dev` เป็น workers.dev subdomain ที่ Cloudflare แจกจาก `"name": "kids-tutor"` ไม่ได้ตั้งค่าในไฟล์ไหน — **ห้ามไปหา "ไฟล์ config URL" เพราะไม่มี**
- **แก้ hardcoded domain**: `src/routes/parent/Upload.tsx` เคย hardcode `https://kids-tutor.nupark.workers.dev/contract` ไว้ใน prompt template ทั้งที่ลิงก์ ingest ในไฟล์เดียวกันใช้ `window.location.origin` — ถ้าย้าย domain (เช่นไป `tutor.yourpower.today`) prompt จะชี้ domain เก่าเงียบๆ ตอนนี้ใช้ `${window.location.origin}/contract` แล้ว
- **ยุบ prompt template ที่ซ้ำ 2 ที่** (textarea value + onClick ของปุ่ม copy) ให้เหลือตัวแปรเดียว `ingestPrompt` — เดิมถ้าแก้ที่เดียวจะ drift
- ตรวจแล้วไม่เหลือ hardcoded `kids-tutor.nupark.workers.dev` ใน `src/`, `worker/`, `shared/` เลย
- `npm.cmd test` ผ่าน 22/22, build ผ่าน, deploy production สำเร็จ: **version `93a409df-eae1-4394-a24d-89f29a1b53e2`**

> กฎที่ได้จากรอบนี้: **ห้าม hardcode domain ในโค้ด** ฝั่ง client ใช้ `window.location.origin` เสมอ (ฝั่ง worker ใช้ค่าจาก request URL) เพื่อให้ย้าย domain ได้โดยไม่ต้องไล่แก้

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
- ถ้าจะย้ายไป custom domain (เช่น `tutor.yourpower.today`) — เพิ่ม `routes`/custom domain ใน `wrangler.jsonc` ฝั่งเดียว โค้ดไม่ต้องแก้แล้ว เพราะ client ใช้ `window.location.origin` ทั้งหมด (ดูรอบ 4.3)
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
# อัปเดตล่าสุดจาก Codex (2026-07-08)

- ปรับหน้า `/parent/admin` ให้ใช้ layout แบบ folder tree ด้านซ้าย + workspace ด้านขวา เพื่อให้ concept ใกล้กับหน้า management อื่น ๆ
- ในหน้า `ดูแลข้อมูล > แบบฝึกหัด` เลือกแบบฝึกหัดได้หลายชุด แล้วกด `ลบที่เลือก` เพื่อลบพร้อมกันได้
- เพิ่ม backend endpoint `DELETE /api/parent/admin/exercise-sets` รับ `{ ids: number[] }` สำหรับ bulk delete แบบฝึกหัด โดยจำกัดสูงสุด 100 ชุดต่อครั้ง
- เพิ่ม responsive CSS ให้ tree layout กลายเป็นแนวตั้งบนหน้าจอเล็ก
- ปรับ information architecture รอบครอบครัว:
  - `/play` เป็น family homepage แสดงชื่อครอบครัว, หัวข้อ `สมาชิกครอบครัว`, tile เด็ก และ tile `ผู้ปกครอง`
  - `/parent` เป็นหน้า `ดูแลข้อมูล` หลัก รวมภาพรวมครอบครัว, โปรไฟล์ครอบครัว, เปลี่ยนรหัสผ่าน, แบบฝึกหัด, เด็ก, R2, ล้างข้อมูล
  - `/parent/admin` redirect กลับ `/parent`
  - เอาคำว่า `โหมดเด็ก` ออกจาก navigation แล้ว
- ปรับ visual theme ให้สบายตาขึ้น: ลดพื้นขาวจัดเป็น off-white/soft gray ทั้ง parent, play, cards, forms, navigation, tree, review panels และ Radix Card/Dialog override (คง print page เป็นขาวสำหรับพิมพ์)
- ตรวจแล้ว: `npm test` ผ่าน 12/12, `npm run build` ผ่าน (มี warning เรื่อง Wrangler log permission นอก workspace เหมือนเดิม)

# อัปเดตล่าสุดจาก Codex (2026-07-09)

- เพิ่ม production smoke test script:
  - คำสั่ง: `npm run smoke:prod`
  - ตรวจ `/api/health`, `/contract`, `/play`, `/parent`, `/avatars/panda.png`, และ bad ingest token ต้องได้ 401
  - รองรับ override URL ด้วย `SMOKE_BASE_URL=https://... npm run smoke:prod`
  - ทดสอบ production แล้วผ่าน 6/6
- เพิ่มฟังก์ชันสร้าง `วิชา` ที่หน้า `/parent/exercises`
  - มีแผง `สร้างวิชา` ในหน้าแบบฝึกหัด
  - สร้างแล้ววิชาขึ้นใน tree ทันที แม้ยังไม่มีแบบฝึกหัด
  - หน้า empty state สามารถสร้างวิชาแรกได้
- ปรับ `POST /api/parent/subjects` ให้ถ้าชื่อวิชาซ้ำใน parent เดิม จะคืนวิชาเดิมกลับมาแทนการสร้าง duplicate
- เพิ่ม test: `subject route reuses existing subject names per parent`
- เพิ่ม `.gitignore` สำหรับ `Avatar/` เพราะเป็นโฟลเดอร์ source สำหรับเตรียมรูป ไม่ใช่ไฟล์ deploy จริง
- ตรวจแล้ว: `npm test` ผ่าน 13/13, `npm run build` ผ่าน, `npm run smoke:prod` ผ่าน 6/6

# อัปเดตล่าสุดจาก Codex (2026-07-10)

- เพิ่ม shared AI import preflight ที่ `shared/import-preflight.ts`
  - ใช้ validation เดียวกันทั้งหน้า Upload และ Worker import
  - รายงาน error/warning แบบอ่านง่าย เช่น ข้อที่ JSON ผิด, `ordering/matching` format ผิด, `imagePage` เกินรูปที่อัปโหลด, diagram format ไม่รองรับ, รูปที่อาจเกินจำเป็น
- หน้า `/parent/upload` แสดงกล่องตรวจ JSON ก่อนสร้างแบบฝึกหัด พร้อมจำนวนข้อ, ประเภทข้อ, รูปที่อ้างถึง, diagram count และรายการที่ต้องแก้
- เพิ่ม admin audit log migration `0011_admin_audit_log.sql`
  - parent admin dangerous actions เขียน log แบบ best-effort: ลบ R2, ลบประวัติ, ลบแบบฝึกหัด, ลบเด็ก
  - super-admin delete parent/R2 เขียน log แบบ best-effort
- เพิ่ม authenticated smoke coverage ใน `npm run smoke:auth`
  - ตรวจ parent admin summary
  - ตรวจ parent R2 file list
  - ถ้าตั้ง `SMOKE_SUPER_ADMIN_TOKEN` จะตรวจ super-admin summary เพิ่ม
- ทำ route-level lazy loading ใน `src/App.tsx` เพื่อลด JS เริ่มต้นและแยก bundle ตามหน้า
- ตรวจแล้ว: `npm test` ผ่าน 19/19, `npm run build` ผ่าน และเห็น client route chunks แยกออกมาแล้ว

# อัปเดตล่าสุดจาก Codex (2026-07-11)

- ปรับ visual system หลักเป็น quiet family workspace แบบ earth tone เขียวหม่นและ off-white ลดความขาวจ้า พร้อมขยาย content width เป็น 1180px
- เพิ่ม `lucide-react` และเปลี่ยน navigation/TreePanel จากสัญลักษณ์ตัวอักษรเป็นไอคอนมาตรฐาน
- ปรับ parent navigation ให้ sticky, active state ชัด, รองรับจอเล็กแบบแถบเมนูเลื่อนได้ และคง touch target ที่เหมาะสม
- ปรับ family homepage ให้ hierarchy ชัดขึ้น มีคำอธิบาย action ใน tile เด็ก/ผู้ปกครอง และ hover/focus state ที่สุภาพ
- แก้ regression สำคัญใน TreePanel: node ระดับย่อยเคยเป็นตัวอักษรเกือบขาวบนพื้นอ่อน ตอนนี้ใช้สีเข้มและ hierarchy ที่อ่านง่ายทั้ง `/parent`, `/parent/exercises`, `/parent/children`
- เพิ่ม global keyboard focus ring และ tap highlight behavior เพื่อ accessibility
- อัปเดต `DESIGN.md` ให้ palette และกติกาตรงกับระบบจริง รวมข้อห้ามเรื่องสีเขียวบนพื้นเขียวและแนวทาง responsive
- ตรวจแล้ว: `npm test` ผ่าน 19/19 และ `npm run build` ผ่าน (มี warning Wrangler log permission หลัง build ซึ่งไม่ทำให้ build ล้ม)
# อัปเดต UI/UX รอบ workspace refresh (2026-07-11)

- ปรับ Radix theme จาก indigo/slate เป็น grass/olive และรวม palette ใหม่เป็น earth-tone neutral ที่ contrast ชัดกว่าเดิม
- `ExplorerLayout`: desktop เป็น 2-pane; tablet/mobile ซ่อน tree ไว้หลังปุ่ม `แสดงเมนู` ไม่วาง tree ยาวเหนือ workspace
- `TreePanel`: item ปกติใช้พื้นโปร่งและข้อความเข้ม, active ใช้พื้นอ่อนพร้อมแถบด้านซ้าย, badge เป็น neutral และมี `aria-current`
- ลด card ซ้อน card: list แบบฝึกหัดและเด็กรวมเป็น row + divider, selection bar sticky และ summary card เบาลง
- เพิ่ม `AppNotifications` พร้อม live region และเปลี่ยน error/success feedback หลักจาก browser alert เป็น notification ที่ไม่ขัดจังหวะ
- ปรับ family homepage, child dashboard, exercise row, progress track, navigation และ form control ให้ใช้ token/state เดียวกัน พร้อม touch target และ reduced-motion support
- เปลี่ยนข้อความ `โหมดเด็ก` ที่ยังเหลือในหน้า parent เป็น `หน้าครอบครัว`
- ตรวจแล้ว: `npm test` ผ่าน 19/19 และ `npm run build` ผ่าน; route chunks ยังแยกตามหน้า
- visual screenshot รอบนี้ทำไม่ได้ เพราะ in-app browser ถูกตั้งค่าไม่ให้เปิด `127.0.0.1:5173`; ควรตรวจภาพจริงหลัง deploy

# อัปเดตล่าสุดจาก Codex (2026-07-12)

- หน้า `/parent/upload` รองรับการนำเข้า JSON จาก AI สองทาง: วาง JSON ในช่องข้อความ หรือกด `เลือกไฟล์ JSON` เพื่ออ่านไฟล์ `.json` โดยตรง
- หลังเลือกไฟล์ ระบบจะแสดงชื่อไฟล์, นำข้อมูลเข้า textarea และรัน import preflight เดิมก่อนอนุญาตให้สร้างแบบฝึกหัด
- ใช้ flow นี้เป็นทางเลือกหลักเมื่อ Claude/AI ภายนอก POST เข้า `https://kids-tutor.nupark.workers.dev` ไม่ได้เพราะ sandbox egress allowlist (`403 Host not in allowlist`): ให้ AI สร้าง `payload.json` แล้วผู้ปกครองนำเข้าเองที่ `/parent/upload`; ชุดที่สร้างจะอยู่สถานะ `pending_review`
- ตรวจแล้ว: `npm test` ผ่าน 19/19 และ `npm run build` ผ่าน (Wrangler log permission warning หลัง build ไม่ทำให้ build ล้ม)
- เพิ่ม AI reasoning feedback แบบ Bring Your Own API key รายครอบครัว
  - provider รุ่นแรก: OpenAI, Gemini, Claude; เลือกได้หนึ่ง provider ต่อครอบครัว
  - ไม่มี fallback key กลางของระบบ ผู้ปกครองรับผิดชอบค่า API เอง และต้องยอมรับหน้าเตือนค่าใช้จ่ายก่อนตั้งค่า
  - API key เข้ารหัส AES-GCM ก่อนเก็บใน D1 และ API ส่งกลับเฉพาะท้าย key 4 ตัว
  - ต้องตั้ง Worker secret `AI_CREDENTIAL_ENCRYPTION_KEY` ก่อนใช้งาน production
- เพิ่ม custom/local AI phase แรก
  - provider `custom` รองรับ OpenAI-compatible `Responses API` และ `Chat Completions API`
  - ผู้ปกครองกรอก `HTTPS base URL`, `model`, `API key/token` (ถ้ามี) และเลือก compatibility mode ในหน้า `/parent/ai`
  - บล็อก `localhost`, private IP, `.local`, non-HTTPS และ URL ที่มี query/hash เพื่อกัน config ที่ Worker production เรียกไม่ได้
  - local model ใช้งานได้ก็ต่อเมื่อเปิดผ่าน public HTTPS gateway ของครอบครัวเอง; Worker จะเรียกเครื่องในบ้านโดยตรงไม่ได้
- เพิ่ม migration `0012_parent_ai_reasoning.sql` สำหรับ provider settings, reasoning fields, AI feedback และ usage log
- เพิ่มหน้า `/parent/ai` สำหรับ consent, provider/model/key, daily/monthly limit, test connection, usage และล้างประวัติ พร้อมคู่มือ `/parent/ai/help`
- ข้อปรนัยยังตรวจถูก/ผิดแบบ deterministic; AI อ่านเฉพาะคำอธิบายของเด็กและไม่เปลี่ยนคะแนน หากไม่มี config/เกิน limit/provider ล่ม การทำแบบฝึกหัดหลักยังทำงานต่อ
- อัปเดต AI Contract เป็น v4: learning objective, difficulty, rationale, distractor rationales และ optional reasoning rubric
- preflight เพิ่ม warning เรื่องตัวเลือกซ้ำ, ตัวลวงอ่อน, คำตอบถูกยาวโดดเด่น, ตัวเลือก “ถูกทุกข้อ/ไม่มีข้อใดถูก” และ correctIndex กระจุกตัว

## Subproject Handoff: Custom/Local AI Gateway Presets

### เป้าหมาย

เพิ่ม preset และคู่มือ setup สำหรับผู้ปกครองที่ต้องการใช้ local/self-hosted AI ผ่านหน้า `/parent/ai` โดยไม่ต้องเดาเองว่า `base URL` และ `mode` ควรใส่อะไร

### เหตุผล

- ตอนนี้ระบบรองรับ provider `custom` แล้ว แต่ผู้ใช้ยังต้องรู้เองว่า gateway ของตัวเองเข้ากับ `Responses API` หรือ `Chat Completions API`
- จุดสับสนหลักคือ local AI มักรันบน `localhost` หรือ private network ซึ่ง Worker production เรียกไม่ถึง
- ถ้ามี preset ที่ชัด จะลด support load และลด error ตอนกด `ทดสอบการเชื่อมต่อ`

### ข้อจำกัดสำคัญของระบบปัจจุบัน

- Worker production เรียก `localhost`, `127.0.0.1`, `192.168.x.x`, `.local` ไม่ได้
- custom endpoint ต้องเป็น `public HTTPS`
- ตอนนี้รองรับเฉพาะ OpenAI-compatible สองแบบ:
  - `Responses API`
  - `Chat Completions API`

### Preset ที่ควรมีใน UI

1. `OpenAI-compatible generic`
- ให้ผู้ใช้กรอกเองทั้งหมด
- fields:
  - `Base URL`
  - `Model`
  - `Mode`
  - `API key/token`

2. `Ollama via OpenAI proxy`
- use case:
  - Ollama รันในบ้านหรือบน VPS แล้วมี proxy ด้านหน้า
- recommended mode:
  - `chat_completions`
- example base URL:
  - `https://ai.family.example/v1`
- example model:
  - `llama3.1:8b`
  - `qwen2.5:7b-instruct`
- note:
  - ถ้าใช้ Ollama ตรง ๆ มักต้องมี proxy adapter เพราะ endpoint native ของ Ollama ไม่ได้ตรงกับ OpenAI ทุกจุด

3. `vLLM OpenAI server`
- use case:
  - self-hosted model บน GPU server
- recommended mode:
  - `chat_completions`
- example base URL:
  - `https://llm.family.example/v1`
- example model:
  - `meta-llama/Llama-3.1-8B-Instruct`
  - `Qwen/Qwen2.5-7B-Instruct`
- note:
  - vLLM มักเข้ากับ OpenAI-style API ได้ดี และเหมาะกับ preset ตัวแรก ๆ

4. `OpenWebUI proxy`
- use case:
  - ครอบครัวมี OpenWebUI อยู่แล้ว และเปิด API/proxy ไว้
- recommended mode:
  - เริ่มจาก `chat_completions`
- example base URL:
  - `https://chat.family.example/api/openai/v1`
  - หรือ `https://chat.family.example/v1` แล้วแต่ reverse proxy
- example model:
  - ชื่อ model ตามที่ OpenWebUI expose
- note:
  - ต้องตรวจ implementation จริงของ OpenWebUI/proxy ที่ใช้ เพราะ path อาจต่างกัน

### ตัวอย่าง config ที่ควรแสดงในหน้า help

#### Ollama ผ่าน proxy

```text
Provider: Custom / Local
Base URL: https://ai.family.example/v1
Mode: Chat Completions API
Model: llama3.1:8b
API key: optional-token-if-proxy-requires-it
```

#### vLLM

```text
Provider: Custom / Local
Base URL: https://llm.family.example/v1
Mode: Chat Completions API
Model: meta-llama/Llama-3.1-8B-Instruct
API key: optional-token-if-gateway-requires-it
```

#### OpenWebUI proxy

```text
Provider: Custom / Local
Base URL: https://chat.family.example/api/openai/v1
Mode: Chat Completions API
Model: qwen2.5-7b-instruct
API key: token-if-configured
```

#### OpenAI-compatible Responses gateway

```text
Provider: Custom / Local
Base URL: https://ai.family.example/v1
Mode: Responses API
Model: gpt-4.1-mini-compatible
API key: optional-token
```

### ข้อเสนอฝั่ง UX

- เพิ่ม `preset dropdown` ในหน้า `/parent/ai` เมื่อเลือก provider `custom`
  - `Generic`
  - `Ollama proxy`
  - `vLLM`
  - `OpenWebUI proxy`
- เมื่อเลือก preset:
  - เติม `mode` ให้ default อัตโนมัติ
  - แสดง placeholder `base URL` และ `model` ให้ตรง preset
  - แสดง warning เฉพาะ preset นั้น เช่น “Ollama ตรง ๆ ใช้ไม่ได้ ต้องผ่าน HTTPS proxy ก่อน”
- เพิ่มปุ่ม `คัดลอกตัวอย่าง config`
- เพิ่ม accordion `ปัญหาที่พบบ่อย`
  - `Worker เรียก localhost ไม่ได้`
  - `ต้องเปิด HTTPS`
  - `proxy path ต้องลงท้าย /v1 หรือไม่`
  - `กด test แล้ว 404/401/500 หมายถึงอะไร`

### ข้อเสนอฝั่ง backend

- ตอนนี้ backend รองรับ `base_url` + `api_format` แล้ว
- phase ถัดไปควรเพิ่ม:
  - error mapping ที่อ่านง่ายขึ้นสำหรับ custom provider
    - `404` = path ไม่ตรง
    - `401/403` = token หรือ proxy auth ผิด
    - `timeout` = gateway ช้า/ปิดอยู่
    - `invalid response` = endpoint ไม่ compatible
  - optional `health probe` ก่อนยิง test reasoning จริง
  - optional model discovery ถ้า gateway รองรับ `/models`

### Checklist ถ้าจะแตกเป็น subproject

1. เพิ่ม `custom preset` UI ใน `/parent/ai`
2. เพิ่ม help page เฉพาะ `Ollama`, `vLLM`, `OpenWebUI`
3. เพิ่ม copy-ready examples ใน `/parent/ai/help`
4. เพิ่ม error translation สำหรับ custom provider
5. เพิ่ม smoke test แบบ mock endpoint สำหรับ `responses` และ `chat_completions`
6. พิจารณาเพิ่ม `GET /models` support สำหรับ custom gateway

### ข้อเสนอการจัดลำดับทำงาน

เฟส 1:
- preset dropdown
- preset-specific placeholder/help
- custom error messages

เฟส 2:
- model discovery
- richer test diagnostics
- help page พร้อม diagram การวาง proxy/tunnel

เฟส 3:
- support gateway templates เพิ่ม เช่น LiteLLM, LM Studio proxy, Azure-compatible proxy ถ้าต้องการ

## Implementation Plan: Custom/Local AI Presets

### เป้าหมายของรอบนี้

ทำให้หน้า `/parent/ai` ใช้งาน custom/local AI ได้ง่ายขึ้นสำหรับผู้ปกครองที่ไม่ได้เชี่ยวชาญ infra โดยเพิ่ม preset, help, diagnostics และ test coverage

### งานที่ต้องทำตามไฟล์

#### 1. `src/routes/parent/AiSettings.tsx`

ต้องเพิ่ม:
- state สำหรับ `customPreset`
  - ค่าแนะนำ: `generic | ollama_proxy | vllm | openwebui`
- config map ของ preset
  - label
  - default `apiFormat`
  - `baseUrlPlaceholder`
  - `modelPlaceholder`
  - warning/help text
- เมื่อเลือก provider `custom`
  - แสดง preset selector เพิ่ม
  - ถ้าเปลี่ยน preset ให้ update placeholder และ default mode
  - อย่าทับค่าที่ผู้ใช้กรอกไปแล้วแบบเงียบ ๆ ยกเว้นช่องยังว่าง
- เพิ่มกล่อง help ใต้ form
  - เช่น `Ollama ต้องผ่าน HTTPS proxy ก่อน`
  - `vLLM มักใช้ Chat Completions`
  - `OpenWebUI path อาจเป็น /api/openai/v1`
- เพิ่ม diagnostics panel หลัง `testConnection`
  - แสดงว่า error ล่าสุดน่าจะเกิดจาก auth / wrong path / timeout / invalid response

สิ่งที่ควรระวัง:
- อย่าให้ preset เปลี่ยนค่า `model` ของผู้ใช้โดยอัตโนมัติถ้าผู้ใช้พิมพ์เองแล้ว
- อย่าใช้ข้อความเตือนยาวจน form ดูรก ควรเป็น compact info panel

#### 2. `src/routes/parent/AiHelp.tsx`

ต้องเพิ่ม:
- section แยกสำหรับ
  - `Ollama via proxy`
  - `vLLM`
  - `OpenWebUI proxy`
- copy-ready examples ที่คัดลอกไปกรอกหน้า `/parent/ai` ได้
- FAQ
  - `ทำไมใช้ localhost ไม่ได้`
  - `ทำไมต้อง HTTPS`
  - `404 แปลว่าอะไร`
  - `401/403 แปลว่าอะไร`
  - `ควรเลือก Responses หรือ Chat Completions`
- optional diagram หรือ text flow
  - `Kids Tutor Worker -> public HTTPS gateway -> local model`

#### 3. `src/styles.css`

ต้องเพิ่ม style สำหรับ:
- preset selector block
- preset help panel
- diagnostics panel
- compact code/example block
- FAQ rows / accordion style

design direction:
- ใช้ earth tone เดิม
- เน้น contrast ชัด
- อย่าใช้เขียวเข้มบนพื้นเขียว
- code example ควรอยู่บน neutral panel แยกจาก warning panel

#### 4. `worker/routes/ai-settings.ts`

ต้องเพิ่ม:
- mapping error ให้ละเอียดขึ้นสำหรับ custom provider
  - `provider_http_404` -> `custom_endpoint_not_found`
  - `provider_http_401` / `provider_http_403` -> `custom_auth_failed`
  - `provider_invalid_response` -> `custom_incompatible_response`
  - timeout/abort -> `custom_timeout`
- ส่ง code ที่ frontend เอาไปแปลผลต่อได้ง่าย
- optional:
  - route ย่อย `POST /ai-settings/test-detailed`
  - return `{ ok, stage, error }`
  - เช่น `stage: "connect" | "auth" | "parse"`

สิ่งที่ควรระวัง:
- อย่าเปิดเผย response body ของ gateway ตรง ๆ กลับหน้าเว็บ
- อย่า log API key หรือ Authorization header

#### 5. `worker/lib/reasoning-ai.ts`

ต้องเพิ่ม:
- แยก custom call path เป็น helper function
  - `callCustomResponses()`
  - `callCustomChatCompletions()`
- จัดการ timeout ให้ distinguish ได้จาก http error
- ถ้า parse JSON ไม่ได้ ให้ throw code ที่ชัดขึ้น
- optional:
  - รองรับ `/models` discovery ภายหลัง โดยแยก helper เตรียมไว้ก่อน

#### 6. `worker/lib/custom-ai.ts`

ตอนนี้มี validation base URL แล้ว

phase ถัดไปควรเพิ่ม:
- helper สำหรับ normalize preset path
  - เช่นถ้า user ใส่ `https://host` แล้ว preset เป็น OpenWebUI อาจช่วย suggest `/api/openai/v1`
- helper สำหรับ classify hostname/path errors
- unit-test-friendly exported functions เพิ่มเติม

#### 7. `tests/run-tests.mjs`

ต้องเพิ่ม test สำหรับ:
- preset/backend compatibility assumptions
  - custom provider with `responses`
  - custom provider with `chat_completions`
- reject cases
  - `localhost`
  - `http://`
  - `.local`
  - private IPv4
  - URL มี query string
- error mapping cases
  - 404 -> endpoint not found
  - 401 -> auth failed
  - timeout -> timeout
- ถ้าทำ `test-detailed` route ให้มี route-level tests ด้วย

#### 8. `README.md`

ต้องเพิ่ม:
- section `Custom / Local AI quick start`
- ตัวอย่าง config สำหรับ
  - Ollama proxy
  - vLLM
  - OpenWebUI proxy
- เตือนชัด ๆ ว่า
  - production Worker เรียก private network ไม่ได้
  - ต้องผ่าน public HTTPS gateway

### การแตก task เป็นลำดับทำงาน

#### Milestone 1: Preset UX
- เพิ่ม preset selector ใน `AiSettings`
- เพิ่ม placeholder/help text ต่อ preset
- เพิ่มตัวอย่างใน `AiHelp`

ผลลัพธ์:
- parent ใช้ custom provider ได้ง่ายขึ้นแม้ยังไม่มี diagnostics ลึก

#### Milestone 2: Better Diagnostics
- เพิ่ม error mapping ฝั่ง worker
- แปลข้อความ error ฝั่ง frontend
- เพิ่ม diagnostics panel หลัง test connection

ผลลัพธ์:
- เวลาต่อ gateway ผิด ผู้ใช้รู้ว่าผิดที่ path, auth, timeout หรือ response format

#### Milestone 3: Stronger Validation + Tests
- เพิ่ม validation helpers
- เพิ่ม test coverage สำหรับ custom cases ให้ครบ
- ตรวจ regressions ของ provider ปกติ

ผลลัพธ์:
- ลดโอกาส config เสียใน production

#### Milestone 4: Optional Discovery
- สำรวจว่าควรเพิ่ม `GET /models` discovery หรือไม่
- ถ้าทำ ให้เป็น best-effort feature ไม่บังคับ

ผลลัพธ์:
- ผู้ใช้เลือก model ง่ายขึ้นในบาง gateway

### ขอบเขตที่ยังไม่ควรทำในรอบแรก

- support endpoint แบบ native Ollama โดยไม่ผ่าน OpenAI-compatible layer
- support auth scheme แปลก ๆ นอกจาก bearer token หรือ no auth
- support WebSocket / streaming
- support private tunnel discovery อัตโนมัติ
- auto-provision reverse proxy ให้ผู้ใช้

### Definition of Done

ถือว่ารอบ subproject นี้เสร็จเมื่อ:
- ผู้ใช้เลือก preset ได้จากหน้า `/parent/ai`
- หน้า help มี copy-ready examples สำหรับ Ollama / vLLM / OpenWebUI
- `test connection` บอกสาเหตุพังได้อ่านง่ายขึ้น
- test ครอบคลุม happy path + invalid custom URL + error mapping
- docs และ handoff อัปเดตตรงกับพฤติกรรมจริง

## Stable state after Phase 3 child polish

- Phase 3 PR was merged into `main`.
- Production smoke and authenticated smoke passed after merge.
- Kid-facing `/play` and `/play/exercises` were checked and fixed for Thai language consistency and readable contrast.
- Child member tiles avoid low-contrast action text on dark green.
- Current design rule to preserve: do not place muted green text or green progress bars on dark green/olive backgrounds. Use high-contrast text on dark surfaces, or neutral/off-white surfaces for green accents.

### Production smoke commands

```powershell
npm run smoke:prod
$env:SMOKE_EMAIL="parent@example.com"
$env:SMOKE_PASSWORD="..."
npm run smoke:auth
npm run smoke:child
```

`smoke:child` is production-safe by default. It logs in, selects the first child, loads the child exercise list, and opens the first assigned exercise detail. It skips gracefully if the family has no child or no assigned exercise.

Optional deeper check:

```powershell
$env:SMOKE_CHILD_START_ATTEMPT="1"
npm run smoke:child
```

This starts or resumes a real child attempt, so use it only when mutation is acceptable.
