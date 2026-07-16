import { BookOpen, House, LogOut, Menu, Settings2, Sparkles, Upload, UsersRound, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const desktopItems = [
  { to: '/play', label: 'ครอบครัว', icon: House },
  { to: '/parent', label: 'ดูแลข้อมูล', icon: Settings2, end: true },
  { to: '/parent/exercises', label: 'แบบฝึกหัด', icon: BookOpen },
  { to: '/parent/upload', label: 'อัปโหลด', icon: Upload },
  { to: '/parent/ai', label: 'AI', icon: Sparkles },
  { to: '/parent/children', label: 'เด็ก', icon: UsersRound },
];

const moreDestinations = new Set(['/parent', '/parent/upload', '/parent/ai']);
const navClass = ({ isActive }: { isActive: boolean }) => isActive ? 'is-active' : undefined;

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout: () => Promise<void> }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMoreOpen(false), [location.pathname]);

  async function logout() {
    setMoreOpen(false);
    await onLogout();
  }

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div className="app-shell-header-inner">
          <NavLink to="/play" className="app-shell-brand">
            <span aria-hidden="true">K</span>
            Kids Tutor
          </NavLink>
          <nav className="app-shell-desktop-nav" aria-label="Main navigation">
            {desktopItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <button className="app-shell-logout" type="button" onClick={logout}>
            <LogOut aria-hidden="true" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </header>

      <main className="app-shell-main">{children}</main>

      {moreOpen && (
        <div className="app-shell-more" id="mobile-more-panel">
          <div className="app-shell-more-header">
            <b>เมนูเพิ่มเติม</b>
            <button type="button" aria-label="ปิดเมนู" onClick={() => setMoreOpen(false)}>
              <X aria-hidden="true" />
            </button>
          </div>
          {desktopItems.filter((item) => moreDestinations.has(item.to)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={logout}>
            <LogOut aria-hidden="true" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      )}

      <nav className="app-shell-mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/play" className={navClass}><House aria-hidden="true" /><span>ครอบครัว</span></NavLink>
        <NavLink to="/parent/exercises" className={navClass}><BookOpen aria-hidden="true" /><span>แบบฝึกหัด</span></NavLink>
        <NavLink to="/parent/children" className={navClass}><UsersRound aria-hidden="true" /><span>เด็ก</span></NavLink>
        <button
          className={moreOpen ? 'is-active' : undefined}
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-panel"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Menu aria-hidden="true" />
          <span>เพิ่มเติม</span>
        </button>
      </nav>
    </div>
  );
}
