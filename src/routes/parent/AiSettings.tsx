import { useEffect, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Switch, Text } from '@radix-ui/themes';
import { ExternalLink, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import { useNotify } from '../../components/AppNotifications';
import type { AiProvider } from '@shared/types';

type Settings = {
  configured: boolean;
  provider?: AiProvider;
  model?: string;
  keyLast4?: string;
  enabled: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
  consentAt?: string;
  dailyUsage?: number;
  monthlyUsage?: number;
};

type ReasoningHistory = { id: number; questionPrompt: string; reasoningText: string; feedback: { message?: string } | null; answeredAt: string };

const PROVIDERS: Array<{ id: AiProvider; name: string; model: string; help: string }> = [
  { id: 'openai', name: 'OpenAI', model: 'gpt-5-mini', help: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Gemini', model: 'gemini-3.5-flash', help: 'https://aistudio.google.com/app/apikey' },
  { id: 'anthropic', name: 'Claude', model: 'claude-sonnet-4-5', help: 'https://console.anthropic.com/settings/keys' },
];

export default function AiSettings() {
  const notify = useNotify();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [consented, setConsented] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState(PROVIDERS[0].model);
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [monthlyLimit, setMonthlyLimit] = useState(300);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ReasoningHistory[]>([]);

  async function load() {
    const value = await api.get<Settings>('/api/parent/ai-settings');
    setSettings(value);
    if (value.configured) {
      setHistory(await api.get<ReasoningHistory[]>('/api/parent/ai-settings/history'));
    } else {
      setHistory([]);
    }
    if (value.configured) {
      setConsented(true);
      setProvider(value.provider!);
      setModel(value.model!);
      setEnabled(value.enabled);
      setDailyLimit(value.dailyLimit ?? 30);
      setMonthlyLimit(value.monthlyLimit ?? 300);
    }
  }

  useEffect(() => { void load(); }, []);

  function chooseProvider(next: AiProvider) {
    setProvider(next);
    setModel(PROVIDERS.find((item) => item.id === next)?.model ?? '');
  }

  async function save() {
    setBusy(true);
    try {
      await api.put('/api/parent/ai-settings', {
        provider, model, apiKey: apiKey || undefined, enabled, dailyLimit, monthlyLimit, consentAccepted: consented,
      });
      setApiKey('');
      await load();
      notify('บันทึกการตั้งค่า AI แล้ว', 'success');
    } catch (error) {
      const code = error instanceof ApiError ? (error.body as { error?: string }).error : '';
      notify(code === 'encryption_not_configured'
        ? 'ระบบยังไม่ได้ตั้ง AI_CREDENTIAL_ENCRYPTION_KEY บน Worker'
        : 'บันทึกไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองใหม่', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    try {
      await api.post('/api/parent/ai-settings/test');
      notify('เชื่อมต่อ AI สำเร็จ', 'success');
    } catch {
      notify('เชื่อมต่อไม่สำเร็จ ตรวจสอบ API key, model และสถานะการชำระเงินกับ provider', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeSettings() {
    await api.delete('/api/parent/ai-settings');
    setSettings({ configured: false, enabled: false });
    setConsented(false);
    setApiKey('');
    notify('ลบ API key และปิด AI feedback แล้ว', 'success');
  }

  async function clearHistory() {
    await api.delete('/api/parent/ai-settings/history');
    setHistory([]);
    notify('ล้างคำอธิบายและ AI feedback แล้ว', 'success');
  }

  if (!settings) return <div className="parent-stack"><Text color="gray">กำลังโหลด...</Text></div>;

  return (
    <div className="parent-stack ai-settings-page">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">AI สำหรับคำอธิบาย</Heading>
          <Text color="gray" size="2">ให้ผู้ช่วยอ่านวิธีคิดของเด็ก โดยใช้ API ของครอบครัวเอง</Text>
        </div>
        {settings.configured && <span className="ai-connected-status"><ShieldCheck size={16} /> เชื่อมต่อ {PROVIDERS.find((item) => item.id === settings.provider)?.name}</span>}
      </div>

      {!consented ? (
        <Card className="parent-panel ai-consent-panel">
          <div className="ai-consent-icon"><Sparkles aria-hidden="true" /></div>
          <Heading as="h3" size="5">การเปิดใช้ AI อาจมีค่าใช้จ่ายเพิ่มเติม</Heading>
          <Text as="p" color="gray">
            ค่าใช้งานจะถูกคิดจากบัญชีของ provider ที่ผู้ปกครองเลือกโดยตรง Kids Tutor ไม่รวมและไม่บวกค่าบริการ AI เพิ่ม
          </Text>
          <ul className="ai-consent-list">
            <li>ผู้ปกครองเป็นผู้รับผิดชอบค่า API และควรตั้ง budget alert กับ provider</li>
            <li>ระบบส่งเฉพาะโจทย์ ตัวเลือก rubric และคำอธิบาย ไม่ส่งชื่อเด็กหรือข้อมูลครอบครัว</li>
            <li>ปิดการใช้งานหรือลบ API key ได้ตลอดเวลา</li>
            <li>หากไม่เปิดใช้ เด็กยังทำแบบฝึกหัดและดูเฉลยได้ตามปกติ</li>
          </ul>
          <Button onClick={() => setConsented(true)}>เข้าใจและเริ่มตั้งค่า</Button>
        </Card>
      ) : (
        <>
          <Card className="parent-panel">
            <Heading as="h3" size="4">เลือก AI provider</Heading>
            <div className="ai-provider-grid">
              {PROVIDERS.map((item) => (
                <button key={item.id} className={`ai-provider-option ${provider === item.id ? 'selected' : ''}`} onClick={() => chooseProvider(item.id)}>
                  <b>{item.name}</b><span>{item.model}</span>
                </button>
              ))}
            </div>

            <div className="ai-settings-form">
              <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} /></label>
              <label>API key
                <input type="password" autoComplete="off" placeholder={settings.configured ? `เก็บไว้แล้ว ••••${settings.keyLast4}` : 'วาง API key'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
              </label>
              <Text color="gray" size="1"><KeyRound size={13} /> Key จะถูกเข้ารหัสและจะไม่แสดงกลับมาอีก</Text>
              <div className="ai-limit-grid">
                <label>สูงสุดต่อวัน<input type="number" min="1" max="500" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} /></label>
                <label>สูงสุดต่อเดือน<input type="number" min="1" max="10000" value={monthlyLimit} onChange={(event) => setMonthlyLimit(Number(event.target.value))} /></label>
              </div>
              <label className="ai-enabled-row"><Switch checked={enabled} onCheckedChange={setEnabled} /> เปิดใช้ AI feedback</label>
            </div>
            {settings.configured && (
              <div className="ai-usage-summary">
                <span><b>{settings.dailyUsage ?? 0}</b> / {settings.dailyLimit} ครั้งวันนี้</span>
                <span><b>{settings.monthlyUsage ?? 0}</b> / {settings.monthlyLimit} ครั้งเดือนนี้</span>
              </div>
            )}
            <Flex gap="3" wrap="wrap" mt="4">
              <Button onClick={save} disabled={busy || (!settings.configured && !apiKey.trim())}>{busy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</Button>
              {settings.configured && <Button variant="soft" color="gray" onClick={testConnection} disabled={busy}>ทดสอบการเชื่อมต่อ (มีค่า API)</Button>}
              {settings.configured && (
                <AlertDialog.Root>
                  <AlertDialog.Trigger><Button variant="soft" color="red">ลบ API key</Button></AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="430px">
                    <AlertDialog.Title>ลบ API key และปิด AI feedback?</AlertDialog.Title>
                    <AlertDialog.Description>เด็กยังทำแบบฝึกหัดได้ตามปกติ แต่ระบบจะหยุดอ่านคำอธิบาย</AlertDialog.Description>
                    <Flex gap="3" justify="end" mt="4">
                      <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                      <AlertDialog.Action><Button color="red" onClick={removeSettings}>ลบ API key</Button></AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              )}
            </Flex>
          </Card>

          <section className="ai-help-section">
            <Heading as="h3" size="4">วิธีเตรียม API key</Heading>
            <Text color="gray" size="2">เปิดหน้าจัดการของ provider สร้าง key แยกสำหรับ Kids Tutor และตั้ง budget/usage alert ก่อนนำมาใส่</Text>
            <div className="ai-help-links">
              {PROVIDERS.map((item) => <a key={item.id} href={item.help} target="_blank" rel="noreferrer">{item.name}<ExternalLink size={14} /></a>)}
            </div>
            <Link to="/parent/ai/help"><Button variant="soft" color="gray">เปิดคู่มือแบบละเอียด</Button></Link>
            <Text color="gray" size="1">Custom/Local AI จะเพิ่มในรุ่นถัดไปเมื่อมี endpoint แบบ OpenAI-compatible ที่ Worker เข้าถึงได้อย่างปลอดภัย</Text>
          </section>

          {settings.configured && (
            <section className="ai-history-section">
              <Flex justify="between" align="center" gap="3" wrap="wrap">
                <div><Heading as="h3" size="4">ประวัติคำอธิบาย</Heading><Text color="gray" size="2">แสดงล่าสุดไม่เกิน 50 รายการ</Text></div>
                {history.length > 0 && (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger><Button variant="soft" color="red">ล้างประวัติ AI</Button></AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="430px">
                      <AlertDialog.Title>ล้างคำอธิบายและ AI feedback ทั้งหมด?</AlertDialog.Title>
                      <AlertDialog.Description>คะแนนและคำตอบปรนัยจะยังอยู่ แต่ข้อความที่เด็กเขียนและ feedback จะถูกลบ</AlertDialog.Description>
                      <Flex gap="3" justify="end" mt="4"><AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel><AlertDialog.Action><Button color="red" onClick={clearHistory}>ล้างประวัติ</Button></AlertDialog.Action></Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                )}
              </Flex>
              {history.length === 0 ? <Text color="gray">ยังไม่มีคำอธิบายที่ส่งให้ AI</Text> : history.map((item) => (
                <div className="ai-history-row" key={item.id}>
                  <b>{item.questionPrompt}</b>
                  <span>เด็กอธิบาย: {item.reasoningText}</span>
                  {item.feedback?.message && <span>ผู้ช่วย: {item.feedback.message}</span>}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
