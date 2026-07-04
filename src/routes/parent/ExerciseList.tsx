import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ExerciseSetSummary } from '@shared/types';

const STATUS_TH: Record<string, string> = {
  processing: 'รอคิว Pi',
  extracting: 'AI กำลังแกะโจทย์',
  pending_review: 'รอตรวจ',
  extraction_failed: 'แกะโจทย์ไม่สำเร็จ',
  published: 'เผยแพร่แล้ว',
};

const PROVIDER_TH: Record<string, string> = {
  claude: 'Claude',
  other_cloud: 'Cloud AI สำรอง',
  pi: 'Raspberry Pi',
};

export default function ExerciseList() {
  const nav = useNavigate();
  const [sets, setSets] = useState<ExerciseSetSummary[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');

  useEffect(() => {
    api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then(setSets);
    // Poll while any set is still queued/extracting (e.g. waiting on the Pi).
    const t = setInterval(() => {
      api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then((data) => {
        setSets(data);
        if (!data.some((s) => s.status === 'processing' || s.status === 'extracting')) {
          clearInterval(t);
        }
      });
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('ลบแบบฝึกหัดและรูปภาพ?')) return;
    setLoading(true);
    try {
      await api.delete(`/api/parent/exercise-sets/${id}`);
      setSets(sets.filter((s) => s.id !== id));
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: number, newTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/api/parent/exercise-sets/${id}`, { title: newTitle.trim() });
      setSets(sets.map((s) => (s.id === id ? { ...s, title: newTitle.trim() } : s)));
      setEditingId(null);
    } catch (err) {
      alert('เปลี่ยนชื่อไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (s: ExerciseSetSummary, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const toggleSelected = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const openMerge = () => {
    const firstTitle = sets.find((s) => s.id === Math.min(...selected))?.title ?? '';
    setMergeTitle(firstTitle ? `${firstTitle} (รวม)` : '');
    setMerging(true);
  };

  const confirmMerge = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ id: number }>('/api/parent/exercise-sets/merge', {
        setIds: [...selected],
        title: mergeTitle,
      });
      setMerging(false);
      setSelected(new Set());
      nav(`/parent/exercises/${res.id}`);
    } catch (err) {
      alert('รวมชุดไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 className="grow">แบบฝึกหัด</h2>
        <Link to="/parent/upload"><button>+ อัปโหลดรูป</button></Link>
      </div>

      {selected.size >= 2 && (
        <div className="card" style={{ marginBottom: 16, padding: 12 }}>
          <div className="row">
            <span className="grow">เลือก {selected.size} ชุด</span>
            <button onClick={openMerge} disabled={loading}>🔗 รวมชุด</button>
          </div>
        </div>
      )}

      {merging && (
        <div className="card">
          <h3>รวม {selected.size} ชุดเป็นชุดเดียว</h3>
          <p className="muted">โจทย์และรูปทุกหน้าจะถูกรวมกัน สถานะจะกลับเป็น "รอตรวจ" ให้ตรวจซ้ำก่อนเผยแพร่</p>
          <input
            placeholder="ชื่อชุดที่รวมแล้ว"
            value={mergeTitle}
            onChange={(e) => setMergeTitle(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="row">
            <button onClick={confirmMerge} disabled={loading}>ยืนยันรวมชุด</button>
            <button className="secondary" onClick={() => setMerging(false)} disabled={loading}>ยกเลิก</button>
          </div>
        </div>
      )}

      {sets.length === 0 && (
        <div className="card muted">ยังไม่มีแบบฝึกหัด อัปโหลดรูปถ่ายแบบฝึกหัดเพื่อเริ่มต้น</div>
      )}

      {sets.map((s) => (
        <div key={s.id}>
          {editingId === s.id ? (
            <div className="card" style={{ padding: 16 }}>
              <div className="row" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="ชื่อแบบฝึกหัด"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <button
                  onClick={(e) => handleRename(s.id, editTitle, e)}
                  disabled={loading}
                  style={{ marginRight: 4 }}
                >
                  บันทึก
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} disabled={loading}>
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <Link to={`/parent/exercises/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card row">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onClick={(e) => toggleSelected(s.id, e)}
                  onChange={() => {}}
                  disabled={loading}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{s.title || `ชุดที่ ${s.id}`}</div>
                  <div className="muted">
                    {s.subjectName ?? 'ไม่ระบุวิชา'} · {s.questionCount} ข้อ ·{' '}
                    {s.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}
                    {s.extractionProvider && ` · แกะโดย ${PROVIDER_TH[s.extractionProvider]}`}
                  </div>
                </div>
                <span className={`badge ${s.status}`} style={{ marginRight: 8 }}>
                  {STATUS_TH[s.status] ?? s.status}
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    onClick={(e) => startEdit(s, e)}
                    disabled={loading}
                    title="เปลี่ยนชื่อ"
                    style={{ fontSize: 16, width: 32, height: 32, padding: 0 }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    disabled={loading}
                    title="ลบ"
                    style={{ fontSize: 16, width: 32, height: 32, padding: 0, background: '#fee' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
