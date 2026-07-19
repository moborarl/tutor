export type PromptTemplateKind = 'multiple_choice' | 'short_answer' | 'ordering' | 'matching' | 'exam';

export const PROMPT_TEMPLATE_OPTIONS: Array<{ value: PromptTemplateKind; label: string }> = [
  { value: 'multiple_choice', label: 'ปรนัย' },
  { value: 'short_answer', label: 'คำตอบสั้น' },
  { value: 'ordering', label: 'เรียงลำดับ' },
  { value: 'matching', label: 'จับคู่' },
  { value: 'exam', label: 'โหมดสอบ' },
];

const TEMPLATE_RULES: Record<PromptTemplateKind, string> = {
  multiple_choice: 'สร้างคำถาม multiple_choice เป็นหลัก ทุกข้อมีตัวเลือก 4 ตัวเลือก กระจาย correctIndex และเขียน distractorRationales ที่อธิบายความเข้าใจผิดของตัวเลือกหลอก',
  short_answer: 'สร้างคำถาม fill_blank หรือ short_answer เป็นหลัก ให้ answer รองรับคำตอบที่ยอมรับได้หลายรูปแบบเมื่อเหมาะสม',
  ordering: 'สร้างคำถาม ordering เป็นหลัก ใช้ content.items และ answer.indices ให้ครบ ตรวจลำดับจากเนื้อหาจริง',
  matching: 'สร้างคำถาม matching เป็นหลัก ใช้ content.left, content.right และ answer.pairs โดย index เริ่มที่ 0',
  exam: 'สร้างชุดแบบฝึกหัดสำหรับโหมดสอบ ห้ามเปิดเผยคำใบ้หรือเฉลยใน prompt และให้ explanation ใช้หลังส่งคำตอบเท่านั้น',
};

export function buildPromptTemplate({
  kind,
  subject,
  ageBand,
  contractUrl,
  ingestUrl,
}: {
  kind: PromptTemplateKind;
  subject: string;
  ageBand: string;
  contractUrl: string;
  ingestUrl: string;
}) {
  return `คุณคือครูผู้เชี่ยวชาญด้านการออกแบบแบบฝึกหัดวิชา ${subject || '[วิชา]'} สำหรับ ${ageBand}

สร้าง JSON ตาม contract เท่านั้น ห้ามใส่ markdown หรือข้อความนอก JSON

แนวทางของ template นี้:
${TEMPLATE_RULES[kind]}

ข้อกำหนดร่วม:
- ทุกข้อมี questionType, prompt, content, answer และ explanation
- สร้างคำถามจากเนื้อหาที่แนบมาเท่านั้น อย่าเดาคำตอบจากรูปที่อ่านไม่ชัด
- ใช้ภาษาเดียวกับเนื้อหาต้นฉบับ และกระจายความยากโดยไม่ใส่เลขข้อใน prompt

อ่าน contract ฉบับเต็ม:
${contractUrl}

ลิงก์ส่ง JSON:
${ingestUrl || '[สร้างลิงก์ ingest จากหน้าเว็บก่อน]'}

ส่งผลลัพธ์เป็น {"title":"...","questions":[...]} เท่านั้น`;
}
