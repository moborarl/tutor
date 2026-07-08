import { useEffect, useState } from 'react';
import { Button } from '@radix-ui/themes';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
        <NavLink to="/parent" className="parent-brand">Kids Tutor</NavLink>
        <NavLink to="/parent" end>ครอบครัว</NavLink>
        <NavLink to="/parent/exercises">แบบฝึกหัด</NavLink>
        <NavLink to="/parent/upload">อัปโหลด</NavLink>
        <NavLink to="/parent/children">เด็ก</NavLink>
        <NavLink to="/parent/admin">ดูแลข้อมูล</NavLink>
        <NavLink to="/play" className="mode-switch-link">โหมดเด็ก</NavLink>
        <span className="grow" />
        <Button variant="soft" color="gray" onClick={logout}>ออกจากระบบ</Button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
