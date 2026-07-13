import { Button, Heading, Text } from '@radix-ui/themes';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const guides = [
  {
    name: 'OpenAI',
    steps: ['ลงชื่อเข้าใช้ OpenAI Platform', 'เพิ่มวิธีชำระเงินหรือเครดิตตามเงื่อนไขบัญชี', 'สร้าง API key ใหม่สำหรับ Kids Tutor', 'ตั้ง budget/usage alert แล้วนำ key ไปใส่ในหน้าตั้งค่า'],
    keyUrl: 'https://platform.openai.com/api-keys',
    pricingUrl: 'https://platform.openai.com/docs/pricing',
  },
  {
    name: 'Gemini',
    steps: ['เปิด Google AI Studio และเลือก project', 'สร้าง API key ที่จำกัดไว้สำหรับ Gemini API', 'ตรวจ quota และ billing ของ project', 'นำ key ไปใส่ในหน้าตั้งค่า'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  {
    name: 'Claude',
    steps: ['ลงชื่อเข้าใช้ Claude Console', 'เติมเครดิตหรือตั้ง billing ตามเงื่อนไขบัญชี', 'สร้าง API key แยกสำหรับ Kids Tutor', 'ตรวจ usage limit แล้วนำ key ไปใส่ในหน้าตั้งค่า'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    pricingUrl: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  },
];

export default function AiHelp() {
  return <div className="parent-stack ai-help-page">
    <div className="page-heading"><div><Heading as="h2" size="6">คู่มือตั้งค่า AI</Heading><Text color="gray" size="2">API key เปรียบเสมือนรหัสผ่าน ห้ามส่งให้ผู้อื่นหรือใส่ในข้อความสาธารณะ</Text></div><Link to="/parent/ai"><Button variant="soft" color="gray">กลับหน้าตั้งค่า</Button></Link></div>
    <div className="ai-help-guide-list">
      {guides.map((guide) => <section key={guide.name} className="ai-help-guide">
        <Heading as="h3" size="4">{guide.name}</Heading>
        <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <div className="ai-help-links"><a href={guide.keyUrl} target="_blank" rel="noreferrer">สร้าง/จัดการ key <ExternalLink size={14} /></a><a href={guide.pricingUrl} target="_blank" rel="noreferrer">ดูราคาปัจจุบัน <ExternalLink size={14} /></a></div>
      </section>)}
    </div>
    <section className="ai-cost-warning"><b>ข้อควรรู้เรื่องค่าใช้จ่าย</b><span>ราคาของ provider และ model เปลี่ยนได้ กรุณาตรวจหน้าราคาอย่างเป็นทางการก่อนเปิดใช้ และตั้งขีดจำกัดใน Kids Tutor ควบคู่กับ budget alert ของ provider</span></section>
  </div>;
}
