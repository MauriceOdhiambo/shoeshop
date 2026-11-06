'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Booking = { rowNumber: number; orderId: string; shoeId: string; name: string; phone: string; location: string; comment: string; date: string; status: string };
type Shoe = { rowNumber: number; id: string; picture: string; originalPicture?: string; buyingPrice: number; size: string | number; targetPrice: number; status: string; priceSold: number; category: string; stockType: number; hotSale: boolean; salePrice: number; reservedDate?: string };
type AdminUser = { username: string; role: 'Super Admin' | 'Admin'; active: boolean };
type AdminIdentity = { username: string; role: 'Super Admin' | 'Admin' };
type Tab = 'bookings' | 'inventory' | 'add' | 'admins';

export default function Admin() {
  const [logged, setLogged] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<AdminIdentity | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);

  async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch {
      const preview = raw.replace(/\s+/g, ' ').slice(0, 260);
      throw new Error(`Server returned a non-JSON response (HTTP ${response.status}) for ${url}. ${preview || 'The response was empty.'}`);
    }
    if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function refresh() {
    const [bookingData, inventoryData] = await Promise.all([request('/api/admin/bookings'), request('/api/admin/inventory')]);
    setBookings(bookingData.bookings);
    setShoes(inventoryData.shoes);
  }

  async function loadAdmins() {
    if (currentAdmin?.role !== 'Super Admin') return;
    const data = await request('/api/admin/users');
    setAdmins(data.admins);
  }

  useEffect(() => {
    request('/api/admin/me').then(async (data) => {
      setCurrentAdmin(data.admin);
      setLogged(true);
      await refresh();
      if (data.admin.role === 'Super Admin') {
        const users = await request('/api/admin/users');
        setAdmins(users.admins);
      }
    }).catch((e) => { if (e instanceof Error && !/HTTP 401/.test(e.message)) setError(e.message); });
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setCurrentAdmin(data.admin);
      setLogged(true);
      setPassword('');
      await refresh();
      if (data.admin.role === 'Super Admin') {
        const users = await request('/api/admin/users');
        setAdmins(users.admins);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await request('/api/admin/logout', { method: 'POST' });
    setLogged(false);
    setCurrentAdmin(null);
    setPassword('');
    setAdmins([]);
    setTab('bookings');
  }

  async function updateBooking(id: string, status: string) {
    try {
      await request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`Booking ${id} updated.`);
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Update failed'); }
  }

  function changeShoe(id: string, changes: Partial<Shoe>) {
    setShoes((previous) => previous.map((shoe) => shoe.id === id ? { ...shoe, ...changes } : shoe));
  }

  async function saveShoe(shoe: Shoe) {
    try {
      await request('/api/admin/inventory', { method: 'PATCH', body: JSON.stringify({ id: shoe.id, status: shoe.status, priceSold: shoe.priceSold, hotSale: shoe.hotSale, salePrice: shoe.salePrice }) });
      setNotice(`Inventory item ${shoe.id} saved.`);
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Update failed'); }
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice('Please choose an image file.'); return; }
    if (file.size > 4 * 1024 * 1024) { setNotice('Please choose an image 4 MB or smaller.'); return; }
    setImageUrl(''); setImagePreview('');
    setUploadBusy(true); setNotice('Uploading photo to Google Drive…');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/admin/upload-image', { method: 'POST', body: form, cache: 'no-store' });
      const raw = await response.text(); let data: any;
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Photo upload returned a non-JSON response (HTTP ${response.status}).`); }
      if (!response.ok || !data.success) throw new Error(data.message || `Photo upload failed (HTTP ${response.status}).`);
      setImageUrl(data.picture); setImagePreview(URL.createObjectURL(file));
      setNotice('Photo uploaded to Google Drive. Save the shoe to store its image link in Google Sheets.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Photo upload failed.'); }
    finally { setUploadBusy(false); }
  }

  async function addShoe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (uploadBusy) { setNotice('Please wait for the photo upload to finish.'); return; }
    if (!imageUrl) { setNotice('Please select and upload a shoe photo before saving this item.'); return; }
    try {
      const data = await request('/api/admin/inventory', { method: 'POST', body: JSON.stringify({ picture: imageUrl, buyingPrice: form.get('buyingPrice'), size: form.get('size'), targetPrice: form.get('targetPrice'), category: form.get('category'), comment: form.get('comment'), hotSale: form.get('hotSale') === 'on', salePrice: form.get('salePrice') }) });
      setNotice(`New item added: ${data.id}`);
      formElement.reset();
      setImageUrl(''); setImagePreview('');
      await refresh();
      setTab('inventory');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not add item'); }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const data = await request('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password'), role: form.get('role') }) });
      setNotice(data.message);
      formElement.reset();
      await loadAdmins();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not create administrator'); }
  }

  async function updateAdmin(username: string, changes: Record<string, unknown>) {
    try {
      const data = await request('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ username, ...changes }) });
      setNotice(data.message);
      setResetPasswords((previous) => ({ ...previous, [username]: '' }));
      await loadAdmins();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not update administrator'); }
  }

  if (!logged) return <>
    <header className="topbar"><div className="topbar-in"><a className="brand" href="/">SHOE<span>STUDIO.</span></a><span>Administrator access</span></div></header>
    <main className="shell" style={{ maxWidth: 480, paddingTop: 70 }}><section className="panel">
      <div className="eyebrow">Secure workspace</div><h2 style={{ marginTop: 8 }}>Admin sign in</h2>
      <p className="muted">Sign in with the username and password assigned to you by the Super Admin.</p>
      {error && <div className="notice error">{error}</div>}
      <form onSubmit={login}>
        <div className="field"><label>Username</label><input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username"/></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"/></div>
        <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="muted" style={{ marginTop: 18 }}><a href="/">← Return to shop</a></p>
    </section></main>
  </>;

  const sold = shoes.filter((shoe) => shoe.status.toLowerCase() === 'sold').length;
  const available = shoes.filter((shoe) => shoe.status.toLowerCase() === 'available').length;
  const isSuperAdmin = currentAdmin?.role === 'Super Admin';

  return <>
    <header className="topbar"><div className="topbar-in"><a className="brand" href="/">SHOE<span>STUDIO.</span> <small style={{ fontSize: 11, color: '#cbd5e1' }}>ADMIN</small></a><div className="top-actions"><span className="muted">{currentAdmin?.username} · {currentAdmin?.role}</span><a className="linkbtn" href="/">View shop</a><button className="linkbtn" onClick={logout}>Sign out</button></div></div></header>
    <main className="shell">
      <div className="admin-head"><div><div className="eyebrow">Management workspace</div><h1>Business overview</h1><p className="muted">Signed in as {currentAdmin?.username} ({currentAdmin?.role})</p></div><button className="btn secondary" onClick={() => refresh().catch((e) => setNotice(e.message))}>Refresh data ↻</button></div>
      {notice && <div className="notice">{notice}</div>}
      <div className="stats"><div className="stat"><small>Total inventory</small><strong>{shoes.length}</strong></div><div className="stat"><small>Available</small><strong>{available}</strong></div><div className="stat"><small>Sold</small><strong>{sold}</strong></div><div className="stat"><small>Customer enquiries</small><strong>{bookings.length}</strong></div></div>
      <div className="admin-layout">
        <nav className="side">
          <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>Customer bookings</button>
          <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Inventory</button>
          <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>Add new shoe</button>
          {isSuperAdmin && <button className={tab === 'admins' ? 'active' : ''} onClick={() => { setTab('admins'); loadAdmins().catch((e) => setNotice(e.message)); }}>Administrator accounts</button>}
        </nav>
        <section className="panel">
          {tab === 'bookings' ? <>
            <h2>Customer bookings</h2><p className="muted">Review customer enquiries and update their progress.</p>
            <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Item</th><th>Contact</th><th>Date</th><th>Status</th></tr></thead><tbody>
              {bookings.map((booking) => <tr key={booking.orderId}><td>{booking.orderId}</td><td>{booking.name}<div className="muted">{booking.location}</div></td><td>{booking.shoeId}</td><td>{booking.phone}</td><td>{booking.date ? new Date(booking.date).toLocaleDateString() : '—'}</td><td><select value={booking.status} onChange={(e) => updateBooking(booking.orderId, e.target.value)}><option>New Enquiry</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select></td></tr>)}
            </tbody></table>{bookings.length === 0 && <div className="empty">No customer bookings have been received yet.</div>}</div>
          </> : tab === 'inventory' ? <>
            <h2>Inventory management</h2><p className="muted">Update stock availability. Prices and purchase records remain in the spreadsheet.</p>
            <div className="table-wrap"><table><thead><tr><th>Photo</th><th>Item</th><th>Buy price</th><th>Target price</th><th>Sold price</th><th>Status</th><th>Hot Sale</th><th>Sale price</th><th>Action</th></tr></thead><tbody>
              {shoes.map((shoe) => <tr key={shoe.id}><td><img src={shoe.picture||'/images/shoe-placeholder.svg'} alt={shoe.category} width={56} height={56} style={{objectFit:'cover',borderRadius:8}} referrerPolicy="no-referrer" onError={(e)=>{const img=e.currentTarget;if(img.dataset.fallback!=='used'&&shoe.originalPicture){img.dataset.fallback='used';img.src=shoe.originalPicture;}else img.src='/images/shoe-placeholder.svg';}}/></td><td><strong>{shoe.category}</strong><div className="muted">{shoe.id} · Size {shoe.size}</div></td><td>KSh {shoe.buyingPrice.toLocaleString()}</td><td>KSh {shoe.targetPrice.toLocaleString()}</td><td><input aria-label={`Sold price for ${shoe.id}`} type="number" min="0" step="1" value={shoe.priceSold || ''} style={{width:105}} onChange={(e)=>changeShoe(shoe.id,{priceSold:Number(e.target.value)})}/></td><td><select value={shoe.status} onChange={(e)=>changeShoe(shoe.id,{status:e.target.value})}><option>Available</option><option>Reserved</option><option>Sold</option></select></td><td><input aria-label={`Hot Sale for ${shoe.id}`} type="checkbox" checked={shoe.hotSale} onChange={(e)=>changeShoe(shoe.id,{hotSale:e.target.checked})}/></td><td><input aria-label={`Sale price for ${shoe.id}`} type="number" min="0" step="1" value={shoe.salePrice || ''} style={{width:105}} onChange={(e)=>changeShoe(shoe.id,{salePrice:Number(e.target.value)})}/></td><td><button className="btn" onClick={()=>saveShoe(shoe)}>Save</button></td></tr>)}
            </tbody></table></div>
          </> : tab === 'add' ? <>
            <h2>Add a new shoe</h2><p className="muted">Choose a photo from your device. It will be uploaded to your Google Drive photo folder, and its link will be saved in the Picture column when you save the shoe.</p>
            <form onSubmit={addShoe}><div className="field"><label>Shoe photo *</label><input type="file" accept="image/*" onChange={(e)=>uploadImage(e.target.files?.[0])} disabled={uploadBusy} required={!imageUrl}/>{uploadBusy&&<span className="muted">Uploading photo to Google Drive…</span>}{imagePreview&&<img src={imagePreview} alt="Selected shoe preview" style={{width:180,height:150,objectFit:'cover',borderRadius:10}}/>}{imageUrl&&<span className="muted">Google Drive image uploaded ✓</span>}</div><div className="field"><label>Category *</label><input name="category" required placeholder="Sneakers, formal, casual…"/></div><div className="field"><label>Size *</label><input name="size" required/></div><div className="field"><label>Buying price (KSh) *</label><input name="buyingPrice" type="number" min="0" step="0.01" required/></div><div className="field"><label>Target selling price (KSh) *</label><input name="targetPrice" type="number" min="0" step="0.01" required/></div><div className="field"><label><input type="checkbox" name="hotSale"/> Mark as Hot Sale</label></div><div className="field"><label>Hot Sale price (optional)</label><input name="salePrice" type="number" min="0" step="0.01" placeholder="Special price"/></div><div className="field"><label>Internal comment</label><textarea name="comment" rows={3}/></div><button className="btn" disabled={uploadBusy || !imageUrl}>Save shoe to inventory</button></form>
          </> : isSuperAdmin ? <>
            <h2>Administrator accounts</h2><p className="muted">Only the Super Admin can create, change, deactivate or reset administrator accounts. Passwords are stored as salted scrypt hashes in Google Sheets.</p>
            <h3>Add administrator</h3>
            <form onSubmit={createAdmin}>
              <div className="field"><label>Username</label><input name="username" required minLength={2} maxLength={40} pattern="[A-Za-z0-9._-]+" placeholder="new.admin"/></div>
              <div className="field"><label>Temporary password (minimum 12 characters)</label><input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></div>
              <div className="field"><label>Role</label><select name="role" defaultValue="Admin"><option value="Admin">Admin – bookings and inventory</option><option value="Super Admin">Super Admin – full access</option></select></div>
              <button className="btn">Create administrator</button>
            </form>
            <h3 style={{ marginTop: 28 }}>Current administrators</h3>
            <div className="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Account status</th><th>Change role</th><th>Reset password</th></tr></thead><tbody>
              {admins.map((admin) => <tr key={admin.username}>
                <td>{admin.username}{admin.username.toLowerCase() === currentAdmin?.username.toLowerCase() ? ' (you)' : ''}</td>
                <td>{admin.role}</td>
                <td><button className="linkbtn" disabled={admin.username.toLowerCase() === currentAdmin?.username.toLowerCase()} onClick={() => updateAdmin(admin.username, { active: !admin.active })}>{admin.active ? 'Active – deactivate' : 'Inactive – activate'}</button></td>
                <td><select value={admin.role} disabled={admin.username.toLowerCase() === currentAdmin?.username.toLowerCase()} onChange={(e) => updateAdmin(admin.username, { role: e.target.value })}><option value="Admin">Admin</option><option value="Super Admin">Super Admin</option></select></td>
                <td><div className="field" style={{ marginBottom: 6 }}><input aria-label={`New password for ${admin.username}`} type="password" minLength={12} placeholder="New password" value={resetPasswords[admin.username] ?? ''} onChange={(e) => setResetPasswords((previous) => ({ ...previous, [admin.username]: e.target.value }))}/></div><button className="linkbtn" disabled={(resetPasswords[admin.username] ?? '').length < 12} onClick={() => updateAdmin(admin.username, { password: resetPasswords[admin.username] })}>Set password</button></td>
              </tr>)}
            </tbody></table>{admins.length === 0 && <div className="empty">No administrator accounts found.</div>}</div>
          </> : <p className="muted">You do not have permission to view this section.</p>}
        </section>
      </div>
      <footer className="footer">Administrator access uses an HTTP-only session cookie. Permissions are checked against the Admins sheet on every protected request.</footer>
    </main>
  </>;
}
