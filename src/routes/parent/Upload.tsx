import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Subject, AgeBand } from '@shared/types';

export default function Upload() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('young');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Subject[]>('/api/parent/subjects').then(setSubjects);
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      let sid = subjectId;
      if (!sid && newSubject.trim()) {
        const created = await api.post<{ id: number }>('/api/parent/subjects', { name: newSubject.trim() });
        sid = String(created.id);
      }
      const form = new FormData();
      form.append('image', file);
      form.append('ageBand', ageBand);
      form.append('title', title);
      if (sid) form.append('subjectId', sid);
      const res = await api.post<{ id: number; status: string }>('/api/parent/exercise-sets', form);
      nav(`/parent/exercises/${res.id}`);
    } catch {
      setError('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง');
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>อัปโหลดรูปแบบฝึกหัด</h2>
      <div className="card">
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            required
          />
          {preview && (
            <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 12, objectFit: 'contain' }} />
          )}
          <input placeholder="ชื่อชุดแบบฝึกหัด (เว้นว่างให้ AI ตั้งให้)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)}>
            <option value="young">สำหรับเด็กเล็ก</option>
            <option value="older">สำหรับเด็กโต</option>
          </select>
          <div className="row">
            <select className="grow" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— เลือกวิชา —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              className="grow"
              placeholder="หรือพิมพ์วิชาใหม่ เช่น คณิตศาสตร์"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              disabled={!!subjectId}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={!file || busy}>
            {busy ? 'กำลังอัปโหลดและให้ AI แกะโจทย์...' : 'อัปโหลดและแกะโจทย์'}
          </button>
          {busy && <div className="muted">อาจใช้เวลา 10-30 วินาที ถ้าโควตา AI หลักหมด งานจะเข้าคิวรอเครื่อง Raspberry Pi ประมวลผลแทน</div>}
        </form>
      </div>
    </div>
  );
}
