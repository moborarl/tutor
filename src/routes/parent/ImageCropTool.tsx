import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api-client';

interface Props {
  setId: number;
  images: { id: number; orderIndex: number }[];
  onCropped: (imageId: number) => void;
  onClose: () => void;
}

type Point = { x: number; y: number };

const ZOOM_LEVELS = [1, 1.5, 2, 3];

// Lets the parent pick one of the uploaded worksheet pages, then drag-select a
// rectangle on it. The selection is cropped client-side (canvas) and uploaded
// as a new page image, which the caller then assigns to a question. Used to
// fix an AI-generated diagram that turned out wrong, with a real photo crop.
//
// Drag handling uses native touch/mouse listeners (attached via addEventListener
// with { passive: false }) instead of React's Pointer Event props or bare
// onTouchMove/onTouchStart — React attaches those as passive listeners in most
// browsers, silently ignoring preventDefault() and letting iOS Safari treat the
// gesture as a native image drag or page scroll instead of our rectangle select.
export function ImageCropTool({ setId, images, onCropped, onClose }: Props) {
  const [pageId, setPageId] = useState<number | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const zoom = ZOOM_LEVELS[zoomIdx];

  function selectPage(id: number) {
    setPageId(id);
    setZoomIdx(0);
    setStart(null);
    setCurrent(null);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el || pageId === null) return;

    // Position relative to the full (possibly zoomed-and-scrolled) image content,
    // not just the visible viewport of the scroll container.
    function relativePos(clientX: number, clientY: number): Point {
      const rect = el!.getBoundingClientRect();
      return {
        x: clientX - rect.left + el!.scrollLeft,
        y: clientY - rect.top + el!.scrollTop,
      };
    }

    function begin(clientX: number, clientY: number) {
      draggingRef.current = true;
      const p = relativePos(clientX, clientY);
      setStart(p);
      setCurrent(p);
    }

    function move(clientX: number, clientY: number) {
      if (!draggingRef.current) return;
      setCurrent(relativePos(clientX, clientY));
    }

    function end() {
      draggingRef.current = false;
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      if (t) begin(t.clientX, t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    }
    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      begin(e.clientX, e.clientY);
    }
    function onMouseMove(e: MouseEvent) {
      move(e.clientX, e.clientY);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', end);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', end);
    };
  }, [pageId]);

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
              onClick={() => selectPage(img.id)}
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
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted grow">ลากเลือกกรอบเฉพาะส่วนแผนภาพ (ซูมเข้าเพื่อเลือกได้แม่นขึ้น)</span>
        <button
          type="button"
          className="secondary"
          onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          disabled={zoomIdx === 0}
          style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
        >
          −
        </button>
        <span className="muted" style={{ minWidth: 34, textAlign: 'center' }}>{zoom}x</span>
        <button
          type="button"
          className="secondary"
          onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
          disabled={zoomIdx === ZOOM_LEVELS.length - 1}
          style={{ width: 36, height: 36, padding: 0, fontSize: 18 }}
        >
          +
        </button>
      </div>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          maxHeight: 420,
          overflow: 'auto',
          touchAction: 'none',
          cursor: 'crosshair',
          border: '1px solid #e8e1d5',
          borderRadius: 8,
        }}
      >
        <img
          ref={imgRef}
          src={`/api/parent/exercise-sets/${setId}/images/${pageId}`}
          alt="หน้าที่เลือก"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: 'none',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
            WebkitUserDrag: 'none',
            WebkitTouchCallout: 'none',
          } as React.CSSProperties}
          draggable={false}
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
