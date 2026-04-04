'use client';

import { useEffect, useState } from 'react';

interface Account {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  username: string;
  password: string;
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [token, setToken] = useState('');
  const [form, setForm] = useState<Partial<Account>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('admin_token') || '';
    setToken(t);
    if (t) fetchAccounts(t);
  }, []);

  const fetchAccounts = async (t: string) => {
    const res = await fetch('/api/admin/accounts', {
      headers: { Authorization: `Bearer ${t}` }
    });
    if (res.ok) {
      setAccounts(await res.json());
    } else {
      setError('Not authorized');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/admin/accounts/${editingId}` : '/api/admin/accounts';
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setForm({});
      setEditingId(null);
      fetchAccounts(token);
    } else {
      setError('Error saving account');
    }
  };

  const handleEdit = (acc: Account) => {
    setForm(acc);
    setEditingId(acc.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this account?')) return;
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchAccounts(token);
  };

  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/admin/login';
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Manage IMAP Accounts</h1>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded">
        <input name="email" placeholder="Email" className="mb-2 p-2 border rounded w-full" value={form.email || ''} onChange={handleChange} required />
        <input name="imap_host" placeholder="IMAP Host" className="mb-2 p-2 border rounded w-full" value={form.imap_host || ''} onChange={handleChange} required />
        <input name="imap_port" placeholder="IMAP Port" type="number" className="mb-2 p-2 border rounded w-full" value={form.imap_port || 993} onChange={handleChange} required />
        <input name="username" placeholder="Username" className="mb-2 p-2 border rounded w-full" value={form.username || ''} onChange={handleChange} required />
        <input name="password" placeholder="Password" type="password" className="mb-2 p-2 border rounded w-full" value={form.password || ''} onChange={handleChange} required />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">{editingId ? 'Update' : 'Add'} Account</button>
        {editingId && <button type="button" className="ml-2 text-gray-600" onClick={() => { setForm({}); setEditingId(null); }}>Cancel</button>}
      </form>
      <ul>
        {accounts.map(acc => (
          <li key={acc.id} className="mb-2 p-2 border rounded flex justify-between items-center">
            <div>
              <div className="font-bold">{acc.email}</div>
              <div className="text-xs text-muted-foreground">{acc.imap_host}:{acc.imap_port} | {acc.username}</div>
            </div>
            <div>
              <button className="mr-2 text-blue-600" onClick={() => handleEdit(acc)}>Edit</button>
              <button className="text-red-600" onClick={() => handleDelete(acc.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
