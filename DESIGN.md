# Design System — kids-tutor

แนวทางหน้าตา (visual language) ของแอป ยึด **shadcn/ui**: neutral palette, ขอบบางแทนเงาหนา, radius พอดี, spacing เป็นสเกล ทุกค่าอยู่ใน CSS variables ที่ `src/styles.css` (`:root`) — **อย่า hardcode hex/px ซ้ำ ให้ใช้ token เสมอ**

## Design Tokens

### สี (Colors)
| Token | ค่า | ใช้เมื่อ |
|---|---|---|
| `--bg` | `#f6f7f9` | พื้นหลังหน้าจอผู้ปกครอง |
| `--card` | `#ffffff` | พื้นการ์ด/พื้นผิวยกระดับ |
| `--ink` | `#1a1d23` | ตัวอักษรหลัก |
| `--muted` | `#6b7280` | ตัวอักษรรอง/คำอธิบาย |
| `--border` | `#e3e5e9` | เส้นขอบ |
| `--border-hover` | `#c7cbd1` | ขอบตอน hover |
| `--neutral-soft` | `#eef0f3` | พื้นอ่อน (badge ร่าง ฯลฯ) |
| `--accent` / `--accent-soft` | `#ff7a45` / `#ffe9dc` | สีหลัก (ปุ่ม, โหมดเด็ก, feedback) |
| `--green` / `--green-soft` | `#16a34a` / `#dcfce7` | ถูก/สำเร็จ/เผยแพร่ |
| `--red` / `--red-soft` | `#dc2626` / `#fee2e2` | ผิด/ลบ/error |
| `--blue` / `--blue-soft` | `#2563eb` / `#dbeafe` | เลือก/กำลังทำงาน |
| `--play-bg` | gradient อุ่น→ม่วง | พื้นหลังโหมดเด็กเล่น |

### Spacing (ฐาน 4px)
`--space-1`=4 · `--space-2`=8 · `--space-3`=12 · `--space-4`=16 · `--space-5`=24 · `--space-6`=32

### รูปทรง/เงา
| Token | ค่า |
|---|---|
| `--radius` / `--radius-sm` | `10px` / `8px` |
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

## หมายเหตุงานที่เหลือ (Phase 1b)
inline styles ~150 จุดใน `src/routes/**` ยังต้องทยอยรวบเป็น utility/component class เพื่อความสม่ำเสมอเต็มรูปแบบ
