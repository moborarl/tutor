import { useEffect, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, AgeBand } from '@shared/types';

const AVATARS = ['🐣', '🦁', '🐼', '🦊', '🐸', '🦄', '🐬', '🚀', '🌈', '⭐'];

export default function ChildrenList() {
  const [children, setChildren] = useState<Child[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  function load() {
    api.get<Child[]>('/api/parent/children').then(setChildren);
  }
  useEffect(load, []);

  const toggleSelected = (id: number) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const toggleSelectAll = () => {
    if (selected.size === children.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(children.map((ch) => ch.id)));
    }
  };

  const handleDeleteSingle = async (id: number) => {
    setLoading(true);
    try {
      await api.delete(`/api/parent/children/${id}`);
      load();
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulk = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/api/parent/children/${id}`)));
      setSelected(new Set());
      load();
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">ลูกๆ</Heading>
          <Text color="gray" size="2">จัดการโปรไฟล์ PIN และติดตามความคืบหน้าของแต่ละคน</Text>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>เพิ่มลูก</Button>
      </div>

      {children.length > 0 && selected.size > 0 && (
        <Card className="selection-bar">
          <Flex align="center" gap="3" wrap="wrap">
            <Text className="grow" weight="medium">เลือก {selected.size} ลูก</Text>
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button color="red" variant="soft" disabled={loading}>ลบ {selected.size} ลูก</Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="420px">
                <AlertDialog.Title>ลบ {selected.size} โปรไฟล์?</AlertDialog.Title>
                <AlertDialog.Description size="2">ข้อมูลความก้าวหน้าของโปรไฟล์ที่เลือกจะถูกลบด้วย</AlertDialog.Description>
                <Flex gap="3" justify="end" mt="4">
                  <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                  <AlertDialog.Action><Button color="red" onClick={handleDeleteBulk}>ลบ</Button></AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Flex>
        </Card>
      )}

      {children.length === 0 && !showForm && (
        <Card><Text color="gray">ยังไม่มีโปรไฟล์ลูก กด “เพิ่มลูก” เพื่อเริ่มต้น</Text></Card>
      )}

      {children.length > 0 && (
        <Card className="parent-panel compact">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected.size === children.length && children.length > 0}
              onChange={toggleSelectAll}
              disabled={loading}
            />
            <span>เลือกทั้งหมด</span>
          </label>
        </Card>
      )}

      <div className="children-grid">
        {children.map((ch) => (
        <Card className="child-card" key={ch.id}>
          <div className="child-card-main">
          <input
            type="checkbox"
            checked={selected.has(ch.id)}
            onChange={() => toggleSelected(ch.id)}
            disabled={loading}
            style={{ width: 20, height: 20, cursor: 'pointer' }}
          />
          <span className="child-avatar">{ch.avatar}</span>
          <div className="grow">
            <Text as="div" weight="bold">{ch.name}</Text>
            <Text as="div" color="gray" size="2">{ch.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}</Text>
          </div>
          </div>
          <div className="child-actions">
          <Link to={`/parent/children/${ch.id}/progress`}>
            <Button variant="soft" color="gray" disabled={loading}>ดู Progress</Button>
          </Link>
          <Button variant="soft" color="gray" onClick={() => { setEditing(ch); setShowForm(true); }} disabled={loading}>
            แก้ไข
          </Button>
          <AlertDialog.Root>
            <AlertDialog.Trigger>
              <Button variant="soft" color="red" disabled={loading}>ลบ</Button>
            </AlertDialog.Trigger>
            <AlertDialog.Content maxWidth="420px">
              <AlertDialog.Title>ลบ {ch.name}?</AlertDialog.Title>
              <AlertDialog.Description size="2">ข้อมูลความก้าวหน้าของโปรไฟล์นี้จะถูกลบด้วย</AlertDialog.Description>
              <Flex gap="3" justify="end" mt="4">
                <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                <AlertDialog.Action><Button color="red" onClick={() => handleDeleteSingle(ch.id)}>ลบ</Button></AlertDialog.Action>
              </Flex>
            </AlertDialog.Content>
          </AlertDialog.Root>
          </div>
        </Card>
        ))}
      </div>

      {showForm && (
        <ChildForm
          child={editing}
          onDone={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ChildForm({ child, onDone, onCancel }: { child: Child | null; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(child?.name ?? '');
  const [avatar, setAvatar] = useState(child?.avatar ?? AVATARS[0]);
  const [ageBand, setAgeBand] = useState<AgeBand>(child?.ageBand ?? 'young');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (child) {
        await api.patch(`/api/parent/children/${child.id}`, {
          name, avatar, ageBand, ...(pin ? { pin } : {}),
        });
      } else {
        if (!/^\d{4}$/.test(pin)) { setError('PIN ต้องเป็นตัวเลข 4 หลัก'); return; }
        await api.post('/api/parent/children', { name, avatar, ageBand, pin });
      }
      onDone();
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองใหม่ (PIN ต้องเป็นตัวเลข 4 หลัก)');
    }
  }

  return (
    <Card className="parent-panel">
      <Heading as="h3" size="4">{child ? `แก้ไข ${child.name}` : 'เพิ่มลูก'}</Heading>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="ชื่อเล่น" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="row">
          {AVATARS.map((a) => (
            <Button
              key={a}
              type="button"
              variant={a === avatar ? 'solid' : 'soft'}
              color={a === avatar ? 'indigo' : 'gray'}
              style={{ fontSize: 24, padding: 8, outline: a === avatar ? '3px solid var(--accent)' : 'none' }}
              onClick={() => setAvatar(a)}
            >
              {a}
            </Button>
          ))}
        </div>
        <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)}>
          <option value="young">เด็กเล็ก (UI ง่าย ปุ่มใหญ่)</option>
          <option value="older">เด็กโต</option>
        </select>
        <input
          placeholder={child ? 'PIN ใหม่ 4 หลัก (เว้นว่างถ้าไม่เปลี่ยน)' : 'PIN 4 หลัก'}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
        />
        {error && <div className="error-text">{error}</div>}
        <div className="row">
          <Button type="submit">บันทึก</Button>
          <Button type="button" variant="soft" color="gray" onClick={onCancel}>ยกเลิก</Button>
        </div>
      </form>
    </Card>
  );
}
