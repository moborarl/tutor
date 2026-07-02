import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, AgeBand } from '@shared/types';

const AVATARS = ['🐣', '🦁', '🐼', '🦊', '🐸', '🦄', '🐬', '🚀', '🌈', '⭐'];

export default function ChildrenList() {
  const [children, setChildren] = useState<Child[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);

  function load() {
    api.get<Child[]>('/api/parent/children').then(setChildren);
  }
  useEffect(load, []);

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 className="grow">ลูกๆ</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }}>+ เพิ่มลูก</button>
      </div>

      {children.length === 0 && !showForm && (
        <div className="card muted">ยังไม่มีโปรไฟล์ลูก กด "+ เพิ่มลูก" เพื่อเริ่มต้น</div>
      )}

      {children.map((ch) => (
        <div className="card row" key={ch.id}>
          <span style={{ fontSize: 40 }}>{ch.avatar}</span>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{ch.name}</div>
            <div className="muted">{ch.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}</div>
          </div>
          <Link to={`/parent/children/${ch.id}/progress`}>
            <button className="secondary">ดู Progress</button>
          </Link>
          <button className="secondary" onClick={() => { setEditing(ch); setShowForm(true); }}>แก้ไข</button>
        </div>
      ))}

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
    <div className="card">
      <h3>{child ? `แก้ไข ${child.name}` : 'เพิ่มลูก'}</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="ชื่อเล่น" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="row">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className="secondary"
              style={{ fontSize: 24, padding: 8, outline: a === avatar ? '3px solid var(--accent)' : 'none' }}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
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
          <button type="submit">บันทึก</button>
          <button type="button" className="secondary" onClick={onCancel}>ยกเลิก</button>
        </div>
      </form>
    </div>
  );
}
