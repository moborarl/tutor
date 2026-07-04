import { useRef, useState } from 'react';
import { api } from '../../lib/api-client';

interface Props {
  setId: number;
  images: { id: number; orderIndex: number }[];
  onCropped: (imageId: number) => void;
  onClose: () => void;
}

// Lets the parent pick one of the uploaded worksheet pages, then drag-select a
// rectangle on it. The selection is cropped client-side (canvas) and uploaded
// as a new page image, which the caller then assigns to a question. Used to
// fix an AI-generated diagram that turned out wrong, with a real photo crop.
export function ImageCropTool({ setId, images, onCropped, onClose }: Props) {
  const [pageId, setPageId] = useState<number | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function getRelativePos(e: React.PointerEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getRelativePos(e);
    setStart(p);
    setCurrent(p);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start) return;
    setCurrent(getRelativePos(e));
  }

  const box =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  async function confirmCrop() {
    if (!box || !imgRef.current || box.width < 8 || box.height < 8) {
      setErr('ลากเลือกกรอบให้ใหญ่กว่านี้');
      return;
    }
    setErr('');
    setUploading(true);
    try {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(box.width * scaleX);
      canvas.height = Math.round(box.height * scaleY);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas context');
      ctx.drawImage(
        img,
        box.left * scaleX,
        box.top * scaleY,
        box.width * scaleX,
        box.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/png'),
      );
      const form = new FormData();
      form.append('image', blob, 'crop.png');
      const res = await api.post<{ id: number }>(`/api/parent/exercise-sets/${setId}/images`, form);
      onCropped(res.id);
    } catch {
      setErr('ตัดรูปไม่สำเร็จ ลองใหม่');
    } finally {
      setUploading(false);
    }
  }

  if (pageId === null) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <div className="muted" style={{ marginBottom: 8 }}>เลือกหน้าที่มีแผนภาพ</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {images.map((img) => (
            <img
              key={img.id}
              src={`/api/parent/exercise-sets/${setId}/images/${img.id}`}
              alt={`หน้า ${img.orderIndex + 1}`}
              onClick={() => setPageId(img.id)}
              style={{
                width: 90,
                height: 90,
                objectFit: 'cover',
                borderRadius: 8,
                cursor: 'pointer',
                border: '2px solid #e8e1d5',
              }}
            />
          ))}
        </div>
        <button className="secondary" style={{ marginTop: 10 }} onClick={onClose}>
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ marginBottom: 8 }}>ลากเลือกกรอบเฉพาะส่วนแผนภาพ</div>
      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-block', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <img
          ref={imgRef}
          src={`/api/parent/exercise-sets/${setId}/images/${pageId}`}
          alt="หน้าที่เลือก"
          style={{
            maxWidth: '100%',
            maxHeight: 420,
            display: 'block',
            userSelect: 'none',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            WebkitUserDrag: 'none',
            WebkitTouchCallout: 'none',
          } as React.CSSProperties}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        {box && (
          <div
            style={{
              position: 'absolute',
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              border: '2px dashed var(--accent)',
              background: 'rgba(255,122,69,0.15)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={confirmCrop} disabled={!box || uploading}>
          {uploading ? 'กำลังตัด...' : '✓ ใช้กรอบนี้'}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setStart(null);
            setCurrent(null);
          }}
          disabled={uploading}
        >
          ลากใหม่
        </button>
        <button className="secondary" onClick={() => setPageId(null)} disabled={uploading}>
          เลือกหน้าอื่น
        </button>
        <button className="secondary" onClick={onClose} disabled={uploading}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
