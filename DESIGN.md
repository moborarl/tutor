# Design System — kids-tutor

แนวทางหน้าตา (visual language) ของแอปเป็น **quiet family workspace**: earth tone เขียวหม่น, พื้น off-white, ขอบบางแทนเงาหนา, radius พอดี และ spacing เป็นสเกล ทุกค่าอยู่ใน CSS variables ที่ `src/styles.css` (`:root`) — **อย่า hardcode hex/px ซ้ำ ให้ใช้ token เสมอ**

## Design Tokens

### สี (Colors)
| Token | ค่า | ใช้เมื่อ |
|---|---|---|
| `--bg` | `#edf1ea` | พื้นหลังหลัก ลดแสงจ้าจากสีขาว |
| `--card` | `#fbfcf8` | พื้นการ์ด/พื้นผิวยกระดับ |
| `--ink` | `#18211b` | ตัวอักษรหลัก |
| `--muted` | `#687568` | ตัวอักษรรอง/คำอธิบาย |
| `--border` | `#cfd9ca` | เส้นขอบ |
| `--border-hover` | `#abbba6` | ขอบตอน hover |
| `--neutral-soft` | `#e4eadf` | พื้นอ่อน (badge ร่าง ฯลฯ) |
| `--accent` / `--accent-soft` | `#5f7f5f` / `#e0eadc` | สีหลักของ navigation และ selection |
| `--green` / `--green-soft` | `#16a34a` / `#dcfce7` | ถูก/สำเร็จ/เผยแพร่ |
| `--red` / `--red-soft` | `#dc2626` / `#fee2e2` | ผิด/ลบ/error |
| `--blue` / `--blue-soft` | `#2563eb` / `#dbeafe` | เลือก/กำลังทำงาน |
| `--play-bg` | gradient เขียวอ่อน | พื้นหลังพื้นที่ทำแบบฝึกหัด |

### Spacing (ฐาน 4px)
`--space-1`=4 · `--space-2`=8 · `--space-3`=12 · `--space-4`=16 · `--space-5`=24 · `--space-6`=32

### รูปทรง/เงา
| Token | ค่า |
|---|---|
| `--radius` / `--radius-sm` | `8px` / `8px` |
| `--shadow-sm` | เงาบางของการ์ด |
| `--shadow-md` | เงายกระดับ (โปรไฟล์เด็ก ฯลฯ) |
| font | `'Sarabun', ui-sans-serif, system-ui, …` |

## Component classes (ที่มีแล้ว)
| Class | คือ |
|---|---|
| `button` (+ `.secondary` `.danger` `.success`) | ปุ่ม 4 แบบ |
| `.card` | การ์ดพื้นขาวขอบบาง |
| `.badge` (+ สถานะ: `.correct` `.wrong` `.draft` `.approved` `.published` …) | ป้ายสถานะ |
| `.row` / `.grow` | flex แถว / ยืดเต็ม |
| `.muted` / `.error-text` | ข้อความรอง / error |
| `.option-btn` (+ `.option-radio`) | ตัวเลือกคำตอบพร้อมวงกลม radio |
| `.question-diagram` / `.diagram-svg` | กรอบแผนภาพ (render โดย `DiagramView`) |

## หลักการ
1. **Token ก่อน hardcode** — สี/ระยะ/เงา ใช้ variable เสมอ
2. **ขอบบาง > เงาหนา** — ใช้ `--border` + `--shadow-sm`
3. **โหมดเด็ก (`.ui-simple`) = ใหญ่ขึ้น** ปุ่ม/ตัวอักษรโตกว่าปกติ แต่ token สีชุดเดียวกัน
4. **แผนภาพ render จากโค้ด ไม่ใช่ AI เขียน SVG** — AI ส่ง `diagram` (structured data), `DiagramView` วาดเอง (`shared/diagram.ts`)
5. **ห้ามใช้สีความหมายซ้ำกับพื้น** — เช่น ข้อความเขียว/แถบเขียวบนพื้นเขียว ต้องใช้พื้น neutral หรือเพิ่ม contrast ให้ผ่าน WCAG AA
6. **Explorer ใช้พื้นอ่อน** — tree item ปกติเป็นข้อความเข้มบนพื้นโปร่ง, active ใช้ `--accent-soft`; ห้ามใช้ข้อความขาวกับ item ที่ไม่มีพื้นเข้ม
7. **Responsive แบบ adaptive** — desktop เป็น 2-pane, tablet/mobile เป็น 1-column; navigation เลื่อนได้และ touch target ไม่ต่ำกว่า 40px
8. **ใช้ Lucide สำหรับไอคอนคำสั่ง** — ไม่ใช้ emoji หรือสัญลักษณ์ตัวอักษรใน navigation/tooling เมื่อมีไอคอนมาตรฐานรองรับ

## หมายเหตุงานที่เหลือ (Phase 1b)
inline styles ~150 จุดใน `src/routes/**` ยังต้องทยอยรวบเป็น utility/component class เพื่อความสม่ำเสมอเต็มรูปแบบ
