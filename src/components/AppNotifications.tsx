import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type NotificationTone = 'success' | 'error' | 'info';

interface NotificationItem {
  id: number;
  message: string;
  tone: NotificationTone;
}

const NotificationContext = createContext<(message: string, tone?: NotificationTone) => void>(() => undefined);

export function AppNotifications({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const notify = useCallback((message: string, tone: NotificationTone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="app-notifications" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`app-notification ${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
            {item.tone === 'success' ? <CheckCircle2 aria-hidden="true" /> : item.tone === 'error' ? <CircleAlert aria-hidden="true" /> : <Info aria-hidden="true" />}
            <span>{item.message}</span>
            <button type="button" aria-label="ปิดข้อความ" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotificationContext);
}
