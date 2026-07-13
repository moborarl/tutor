import { useEffect, useState } from 'react';
import { Button } from '@radix-ui/themes';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, House, LogOut, Settings2, Sparkles, Upload, UsersRound } from 'lucide-react';
import { api } from '../../lib/api-client';

export default function ParentLayout() {
  const nav = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .get<{ loggedIn: boolean }>('/api/auth/me')
      .then((me) => {
        if (!me.loggedIn) nav('/parent/login');
        else setChecked(true);
      })
      .catch(() => nav('/parent/login'));
  }, [nav]);

  async function logout() {
    await api.post('/api/auth/logout');
    nav('/');
  }

  if (!checked) return null;

  return (
    <div className="parent-shell">
      <nav className="nav-bar parent-nav">
        <NavLink to="/play" className="parent-brand"><span className="brand-mark">K</span><span>Kids Tutor</span></NavLink>
        <div className="parent-nav-links">
          <NavLink to="/play"><House aria-hidden="true" /><span>ครอบครัว</span></NavLink>
          <NavLink to="/parent" end><Settings2 aria-hidden="true" /><span>ดูแลข้อมูล</span></NavLink>
          <NavLink to="/parent/exercises"><BookOpen aria-hidden="true" /><span>แบบฝึกหัด</span></NavLink>
          <NavLink to="/parent/upload"><Upload aria-hidden="true" /><span>อัปโหลด</span></NavLink>
          <NavLink to="/parent/ai"><Sparkles aria-hidden="true" /><span>AI</span></NavLink>
          <NavLink to="/parent/children"><UsersRound aria-hidden="true" /><span>เด็ก</span></NavLink>
        </div>
        <span className="grow" />
        <Button className="logout-button" variant="soft" color="gray" onClick={logout}><LogOut aria-hidden="true" />ออกจากระบบ</Button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
