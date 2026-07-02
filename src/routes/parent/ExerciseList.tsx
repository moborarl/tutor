import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [sets, setSets] = useState<ExerciseSetSummary[]>([]);

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

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 className="grow">แบบฝึกหัด</h2>
        <Link to="/parent/upload"><button>+ อัปโหลดรูป</button></Link>
      </div>

      {sets.length === 0 && (
        <div className="card muted">ยังไม่มีแบบฝึกหัด อัปโหลดรูปถ่ายแบบฝึกหัดเพื่อเริ่มต้น</div>
      )}

      {sets.map((s) => (
        <Link key={s.id} to={`/parent/exercises/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card row">
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{s.title || `ชุดที่ ${s.id}`}</div>
              <div className="muted">
                {s.subjectName ?? 'ไม่ระบุวิชา'} · {s.questionCount} ข้อ ·{' '}
                {s.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}
                {s.extractionProvider && ` · แกะโดย ${PROVIDER_TH[s.extractionProvider]}`}
              </div>
            </div>
            <span className={`badge ${s.status}`}>{STATUS_TH[s.status] ?? s.status}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
