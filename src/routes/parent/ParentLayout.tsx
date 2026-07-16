import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { AppShell } from '../../components/AppShell';

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

  return <AppShell onLogout={logout}><Outlet /></AppShell>;
}
