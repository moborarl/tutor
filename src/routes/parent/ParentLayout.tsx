import { useEffect, useState } from 'react';
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
    <div>
      <nav className="nav-bar">
        <span style={{ fontWeight: 800, marginRight: 8 }}>📚 Kids Tutor</span>
        <NavLink to="/parent/exercises">แบบฝึกหัด</NavLink>
        <NavLink to="/parent/upload">อัปโหลด</NavLink>
        <NavLink to="/parent/children">ลูกๆ</NavLink>
        <span className="grow" />
        <button className="secondary" onClick={logout}>ออกจากระบบ</button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
