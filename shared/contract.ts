// Single source of truth for the "AI produces exercise JSON" contract.
//
// Everything that tells an AI (any AI — Gemini/ChatGPT/Claude/Codex/agents)
// how to turn a worksheet/textbook into an importable exercise set lives here:
//   - the prompt template shown in the Upload page (copy-paste flow)
//   - the public GET /contract endpoint (fetch flow for automated pipelines)
// Both render from these exports, so the rules can never drift apart.
//
// When the schema changes (e.g. a new diagram type), bump CONTRACT_VERSION and
// note it in the CHANGELOG section at the bottom of the markdown.

export const CONTRACT_VERSION = 2;

// The core prompt: paste into an AI chat together with worksheet photos (or let
// an agent fetch it). Kept in Thai because worksheet content is Thai-first and
// every model in the pipeline handles Thai instructions fine.
export const PROMPT_TEMPLATE = `คุณคือผู้ช่วยแกะโจทย์จากรูปแบบฝึกหัด กรุณาดูรูปที่แนบมาทุกรูป (อาจมีหลายหน้า) แล้วแกะโจทย์ทุกข้อออกมาเป็น JSON ตาม schema ด้านล่างนี้เป๊ะๆ (ตอบเป็น JSON ล้วนๆ เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON ห้ามใช้ \`\`\`json หรือ code block ใดๆ ห้ามใส่ key อื่นนอกจากที่ระบุไว้)

รูปแบบ JSON หลัก (โครงสร้างที่ต้องตอบกลับมา):
{
  "title": "ชื่อชุดแบบฝึกหัดสั้นๆ",
  "questions": [ /* array ของโจทย์แต่ละข้อ ดูตัวอย่างแต่ละประเภทด้านล่าง */ ]
}

ตัวอย่างโจทย์แต่ละประเภท (แต่ละข้อใน "questions" ให้เลือกใช้ 1 แบบตาม questionType โดยใส่ content/answer ตรงๆ ไม่ต้องมี key ครอบซ้ำ):

แบบ multiple_choice (ปรนัย):
{"questionType":"multiple_choice","prompt":"ข้อความโจทย์","content":{"options":["ตัวเลือก1","ตัวเลือก2","ตัวเลือก3"]},"answer":{"correctIndex":0},"explanation":"เหตุผลที่ตอบข้อนี้"}

แบบ fill_blank (เติมคำ ใช้ ___ แทนช่องว่างใน prompt):
{"questionType":"fill_blank","prompt":"ท้องฟ้าสีอะไร ___","content":{"hint":"คำใบ้ถ้ามี"},"answer":{"answers":["ฟ้า","สีฟ้า"]},"explanation":"เหตุผลที่ตอบแบบนี้"}

แบบ matching (จับคู่):
{"questionType":"matching","prompt":"จับคู่ให้ถูกต้อง","content":{"left":["ข้อ1","ข้อ2"],"right":["คำตอบA","คำตอบB"]},"answer":{"pairs":[0,1]},"explanation":"เหตุผลที่จับคู่แบบนี้"}

แบบ true_false (ถูก/ผิด):
{"questionType":"true_false","prompt":"ข้อความที่ต้องตัดสินว่าถูกหรือผิด","content":{},"answer":{"value":true},"explanation":"เหตุผลที่ถูกหรือผิด"}

แบบ fraction (เศษส่วน — เด็กกรอกตัวเศษและตัวส่วน):
{"questionType":"fraction","prompt":"เศษส่วนที่เท่ากับ 1/2 คืออะไร","content":{},"answer":{"numerator":1,"denominator":2},"explanation":"เศษส่วนอื่นเช่น 2/4, 3/6 ก็ถูก"}

ถ้าโจทย์ข้อไหนต้องดูแผนภาพแรง (ลูกศรที่มีขนาด/ทิศทาง) ประกอบถึงจะตอบได้ **ห้ามวาดรูปเอง** ให้ใส่ field "diagram" เป็นข้อมูลตามแบบใดแบบหนึ่งด้านล่างนี้แทน ระบบจะวาดภาพให้เองจากข้อมูลนี้เสมอ (แม่นยำ 100% ไม่มีวันวาดผิด/ตัดจบไม่ครบ):

แบบที่ 1 "force-arrows" — แรงหลายแรงกระทำต่อกล่องเดียว (เช่น "แรง 20 นิวตันสองแรงไปทางซ้าย"):
"diagram": {"type":"force-arrows","items":[{"direction":"left","magnitude":20},{"direction":"right","magnitude":10}]}

แบบที่ 2 "force-arrows-grid" — เปรียบเทียบหลายกล่อง เช่นโจทย์ถามว่า A/B/C/D ข้อไหนแรงลัพธ์มากที่สุด:
"diagram": {"type":"force-arrows-grid","panels":[
  {"label":"A","items":[{"direction":"right","magnitude":10},{"direction":"right","magnitude":10}]},
  {"label":"B","items":[{"direction":"right","magnitude":40},{"direction":"left","magnitude":10}]}
]}

แบบที่ 3 "direction-arrows" — ลูกศรรอบกล่อง 4 ทิศทาง เช่นโจทย์ถามทิศทางแรง/แรงเสียดทาน (direction เป็น up/down/left/right เท่านั้น):
"diagram": {"type":"direction-arrows","arrows":[{"direction":"up","label":"A"},{"direction":"right","label":"C"}]}

ข้อที่ไม่ต้องใช้แผนภาพ (เป็นแค่ข้อความ) ไม่ต้องใส่ field "diagram"

กติกา:
- แกะทุกข้อที่เห็นในทุกรูป ห้ามข้าม รวมถึงข้อที่มีแผนภาพ/กราฟ/รูปวาดประกอบ
- ถ้าโจทย์ไม่มีเฉลยในรูป ให้คิดคำตอบที่ถูกต้องเอง
- ทุกข้อต้องมี "explanation" อธิบายเหตุผลเสมอ เขียนให้เด็กเข้าใจง่าย
- ใช้ภาษาเดียวกับโจทย์ต้นฉบับ (ไทยหรืออังกฤษ)
- correctIndex และ pairs เริ่มนับจาก 0
- ห้ามใส่ key ครอบ เช่น "_multiple_choice" หรือ "multiple_choice" ใน content/answer — ใส่ options/correctIndex/answers/pairs/value ตรงๆ ตามตัวอย่างเท่านั้น
- ห้ามใส่เลขข้อ (เช่น "1." หรือ "9.") นำหน้าข้อความใน "prompt" ระบบจะเรียงลำดับข้อเองอัตโนมัติ`;

// Full contract document, served publicly at GET /contract so any AI or agent
// can fetch the latest rules directly instead of relying on a stale copy.
export function buildContractMarkdown(): string {
  return `# Kids Tutor — สัญญารูปแบบข้อมูลแบบฝึกหัด (AI Contract)

เวอร์ชัน: ${CONTRACT_VERSION}

เอกสารนี้คือกติกากลางสำหรับ AI ทุกตัว (Gemini / ChatGPT / Claude / Codex / agent อื่น ๆ)
ที่ช่วยแปลงแบบเรียนหรือแบบฝึกหัดให้เป็นชุดโจทย์ดิจิทัลของระบบ Kids Tutor

## ขั้นตอนการทำงาน (pipeline)

1. AI ได้รับรูปถ่ายแบบฝึกหัด/เนื้อหาแบบเรียนของหัวข้อหนึ่ง
2. AI ผลิต JSON ตาม prompt ด้านล่างนี้ (JSON ล้วน ห้ามมีข้อความอื่นปน)
3. มนุษย์ (ผู้ปกครอง) นำ JSON ไปวางที่หน้า "อัปโหลด" ของระบบ พร้อมแนบรูปต้นฉบับ
4. ระบบตรวจรูปแบบอัตโนมัติ แล้วเข้าสถานะ "รอตรวจ" ให้ผู้ปกครองอนุมัติทีละข้อก่อนเผยแพร่ให้เด็กทำ

หมายเหตุ: ระบบวาดแผนภาพเองจากข้อมูล "diagram" — AI มีหน้าที่ส่งข้อมูล ไม่ใช่วาดภาพ

## Prompt / กติกาการผลิต JSON

${PROMPT_TEMPLATE}

## Checklist ก่อนส่ง JSON

- [ ] เป็น JSON ล้วนทั้งข้อความ ไม่มี \`\`\` หรือคำอธิบายอื่นนำหน้า/ต่อท้าย
- [ ] มี "title" และ "questions" ครบ
- [ ] ทุกข้อมี questionType / prompt / content / answer / explanation
- [ ] correctIndex และ pairs นับจาก 0
- [ ] ไม่มีเลขข้อนำหน้า prompt
- [ ] field "diagram" (ถ้ามี) ใช้เฉพาะ 3 แบบที่กำหนด ไม่มี SVG/รูปวาดเอง
- [ ] วงเล็บปีกกา/เหลี่ยมปิดครบ (JSON สมบูรณ์)

## การตรวจสอบฝั่งระบบ

- JSON ที่รูปแบบเพี้ยนเล็กน้อย (เช่นมีข้อความอื่นครอบ) ระบบพยายามซ่อมให้อัตโนมัติ แต่อย่าพึ่งพา
- ข้อที่ questionType/prompt ไม่ถูกต้องจะถูกตัดทิ้งทั้งข้อ
- "diagram" ที่รูปแบบไม่ตรง 3 แบบที่กำหนดจะถูกตัดทิ้ง (โจทย์ยังอยู่แต่ไม่มีภาพ)

## ประวัติเวอร์ชัน

- v1 — สี่ประเภทโจทย์ (multiple_choice / fill_blank / matching / true_false) + แผนภาพ 3 แบบ (force-arrows / force-arrows-grid / direction-arrows)
- v2 — เพิ่ม fraction type (เด็กกรอกตัวเศษและตัวส่วน)
`;
}
