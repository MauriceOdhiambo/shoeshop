'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Booking = { rowNumber: number; orderId: string; shoeId: string; name: string; phone: string; location: string; comment: string; date: string; status: string; picture?: string; category?: string; size?: string };
type Shoe = { rowNumber: number; id: string; picture: string; originalPicture?: string; buyingPrice?: number; size: string | number; targetPrice: number; status: string; priceSold: number; category: string; stockType: number; hotSale: boolean; comment: string; pendingAmount: number; reservedDate?: string };
type AdminUser = { username: string; role: 'Super Admin' | 'Admin'; active: boolean };
type AdminIdentity = { username: string; role: 'Super Admin' | 'Admin' };
type Tab = 'bookings' | 'inventory' | 'add' | 'admins' | 'analysis';

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
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [analysisBatch, setAnalysisBatch] = useState<'all' | 'latest' | 'older'>('all');

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
      await request('/api/admin/inventory', { method: 'PATCH', body: JSON.stringify({ id: shoe.id, status: shoe.status, priceSold: shoe.priceSold, hotSale: shoe.hotSale, comment: shoe.comment, pendingAmount: shoe.pendingAmount, ...(isSuperAdmin ? { buyingPrice: shoe.buyingPrice } : {}) }) });
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
      const data = await request('/api/admin/inventory', { method: 'POST', body: JSON.stringify({ picture: imageUrl, ...(isSuperAdmin ? { buyingPrice: form.get('buyingPrice') } : {}), size: form.get('size'), targetPrice: form.get('targetPrice'), category: form.get('category'), comment: form.get('comment'), hotSale: form.get('hotSale') === 'on' }) });
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
      const data = await request('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: form.get('username'), email: form.get('email'), password: form.get('password'), role: form.get('role') }) });
      setNotice(data.message);
      formElement.reset();
      await loadAdmins();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not create administrator'); }
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setNotice('The new passwords do not match.'); return; }
    try {
      const data = await request('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      setNotice(data.message); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPasswordPanel(false);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not update password.'); }
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
    <header className="topbar"><div className="topbar-in"><a className="brand" href="/">SHOE<span>STUDIO.</span></a><span className="topbar-caption">ADMINISTRATOR ACCESS</span></div></header>
    <main className="shell login-shell"><section className="panel login-panel">
      <div className="login-emblem">S<span>.</span></div><div className="eyebrow">SECURE WORKSPACE</div><h2 style={{ marginTop: 8 }}>Welcome back.</h2>
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

  const isSuperAdmin = currentAdmin?.role === 'Super Admin';

  return <>
    <header className="topbar admin-topbar"><div className="topbar-in"><a className="brand" href="/">SHOE<span>STUDIO.</span> <small className="brand-admin">MANAGEMENT</small></a><div className="top-actions"><span className="muted">{currentAdmin?.username} · {currentAdmin?.role}</span><button className="linkbtn" onClick={() => setShowPasswordPanel(true)}>Account security</button><a className="linkbtn" href="/">View shop</a><button className="linkbtn" onClick={logout}>Sign out</button></div></div></header>
    <main className="shell admin-shell">
      <div className="admin-head"><div><div className="eyebrow">SHOE STUDIO OPERATIONS</div><h1>Welcome, {currentAdmin?.username}.</h1><p className="muted">{isSuperAdmin ? 'Business performance and store operations.' : 'Manage customer enquiries and product availability.'}</p></div><button className="btn secondary refresh-btn" onClick={() => refresh().catch((e) => setNotice(e.message))}>↻ <span>Refresh data</span></button></div>
      {notice && <div className="notice">{notice}</div>}

      {showPasswordPanel && <div className="security-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPasswordPanel(false); }}><section className="security-modal" role="dialog" aria-modal="true" aria-labelledby="security-modal-title"><div className="security-modal-head"><div className="security-icon">⌑</div><button type="button" className="security-close" aria-label="Close password settings" onClick={() => setShowPasswordPanel(false)}>×</button></div><div className="eyebrow">ACCOUNT SECURITY</div><h2 id="security-modal-title">Update your password</h2><p className="muted">Choose a strong password to keep your Shoe Studio account secure.</p><form onSubmit={changeOwnPassword} className="security-form"><div className="field"><label>Current password</label><input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter current password"/></div><div className="field"><label>New password</label><input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required minLength={12} autoComplete="new-password" placeholder="At least 12 characters"/><small className="security-hint">Use at least 12 characters. Avoid reusing another password.</small></div><div className="field"><label>Confirm new password</label><input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required minLength={12} autoComplete="new-password" placeholder="Enter the new password again"/></div><div className="security-actions"><button type="button" className="security-cancel" onClick={() => setShowPasswordPanel(false)}>Cancel</button><button className="btn" type="submit">Save new password</button></div></form></section></div>}
      <div className="admin-layout">
        <nav className="side">
          <div className="side-label">WORKSPACE</div><button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}><span>▤</span> Customer bookings <b className="nav-count">{bookings.length}</b></button>
          <button className={tab === 'inventory' || tab === 'add' ? 'active' : ''} onClick={() => setTab('inventory')}><span>▦</span> Inventory</button>
          {isSuperAdmin && <><div className="side-label side-label-spaced">MANAGEMENT</div><button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}><span>▥</span> Business analysis</button><button className={tab === 'admins' ? 'active' : ''} onClick={() => { setTab('admins'); loadAdmins().catch((e) => setNotice(e.message)); }}><span>♙</span> Administrator accounts</button></>}
        </nav>
        <section className="panel admin-content">
          {tab === 'bookings' ? <>
            <div className="content-title"><div><div className="eyebrow">CUSTOMER RELATIONSHIPS</div><h2>Customer bookings</h2><p className="muted">Review incoming enquiries and keep each customer updated.</p></div><span className="content-count">{bookings.length} records</span></div>
            <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Shoe</th><th>Contact</th><th>Date</th><th>Status</th></tr></thead><tbody>
              {bookings.map((booking) => <tr key={booking.orderId}><td>{booking.orderId}</td><td>{booking.name}<div className="muted">{booking.location}</div></td><td><div style={{display:'flex',alignItems:'center',gap:10}}><img src={booking.picture || '/images/shoe-placeholder.svg'} alt={booking.category || 'Shoe'} width={58} height={58} style={{objectFit:'cover',borderRadius:9,flexShrink:0}}/><div><strong>{booking.category || 'Shoe'}</strong><div className="muted">{booking.shoeId} · Size {booking.size || '—'}</div></div></div></td><td>{booking.phone}</td><td>{booking.date ? new Date(booking.date).toLocaleDateString() : '—'}</td><td><select value={booking.status} onChange={(e) => updateBooking(booking.orderId, e.target.value)}><option>New Enquiry</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select></td></tr>)}
            </tbody></table>{bookings.length === 0 && <div className="empty">No customer bookings have been received yet.</div>}</div>
          </> : tab === 'inventory' ? <>
            <div className="content-title"><div><div className="eyebrow">PRODUCT CATALOGUE</div><h2>Inventory management</h2><p className="muted">Manage product details, availability and promotions.</p></div><div className="content-actions"><span className="content-count">{shoes.length} items</span><button className="btn" onClick={() => setTab('add')}>＋ Add shoe</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>Photo</th><th>Item</th>{isSuperAdmin && <th>Buy price</th>}<th>Target price</th><th>Sold price</th><th>Status</th><th>Hot Sale</th><th>Payment note</th><th>Balance due</th><th>Action</th></tr></thead><tbody>
              {shoes.map((shoe) => <tr key={shoe.id}><td><img src={shoe.picture||'/images/shoe-placeholder.svg'} alt={shoe.category} width={56} height={56} style={{objectFit:'cover',borderRadius:8}} referrerPolicy="no-referrer" onError={(e)=>{const img=e.currentTarget;if(img.dataset.fallback!=='used'&&shoe.originalPicture){img.dataset.fallback='used';img.src=shoe.originalPicture;}else img.src='/images/shoe-placeholder.svg';}}/></td><td><strong>{shoe.category}</strong><div className="muted">{shoe.id} · Size {shoe.size}</div></td>{isSuperAdmin && <td><input aria-label={`Buying price for ${shoe.id}`} type="number" min="0" step="1" value={shoe.buyingPrice ?? 0} style={{width:105}} onChange={(e)=>changeShoe(shoe.id,{buyingPrice:Number(e.target.value)})}/></td>}<td>KSh {shoe.targetPrice.toLocaleString()}</td><td><input aria-label={`Sold price for ${shoe.id}`} type="number" min="0" step="1" value={shoe.priceSold || ''} style={{width:105}} onChange={(e)=>changeShoe(shoe.id,{priceSold:Number(e.target.value)})}/></td><td><select value={shoe.status} onChange={(e)=>changeShoe(shoe.id,{status:e.target.value})}><option>Available</option><option>Reserved</option><option>Sold</option></select></td><td><input aria-label={`Hot Sale for ${shoe.id}`} type="checkbox" checked={shoe.hotSale} onChange={(e)=>changeShoe(shoe.id,{hotSale:e.target.checked})}/></td><td><input aria-label={`Payment note for ${shoe.id}`} type="text" value={shoe.comment || ''} placeholder="e.g. Deposit received; balance due" style={{width:190}} onChange={(e)=>changeShoe(shoe.id,{comment:e.target.value})}/></td><td><input aria-label={`Outstanding balance for ${shoe.id}`} type="number" min="0" step="1" value={shoe.pendingAmount || ''} placeholder="0" style={{width:110}} onChange={(e)=>changeShoe(shoe.id,{pendingAmount:Number(e.target.value)})}/></td><td><button className="btn" onClick={()=>saveShoe(shoe)}>Save</button></td></tr>)}
            </tbody></table></div>
          </> : tab === 'add' ? <>
            <div className="content-title"><div><div className="eyebrow">GROW YOUR COLLECTION</div><h2>Add a new shoe</h2><p className="muted">Choose a photo from your device. It will be uploaded to your Google Drive photo folder, and its link will be saved in the Picture column when you save the shoe.</p></div></div>
            <form onSubmit={addShoe} className="admin-form"><div className="field"><label>Shoe photo *</label><input type="file" accept="image/*" onChange={(e)=>uploadImage(e.target.files?.[0])} disabled={uploadBusy} required={!imageUrl}/>{uploadBusy&&<span className="muted">Uploading photo to Google Drive…</span>}{imagePreview&&<img src={imagePreview} alt="Selected shoe preview" style={{width:180,height:150,objectFit:'cover',borderRadius:10}}/>}{imageUrl&&<span className="muted">Google Drive image uploaded ✓</span>}</div><div className="field"><label>Category *</label><input name="category" required placeholder="Sneakers, formal, casual…"/></div><div className="field"><label>Size *</label><input name="size" required/></div>{isSuperAdmin && <div className="field"><label>Buying price (KSh) *</label><input name="buyingPrice" type="number" min="0" step="0.01" required/></div>}<div className="field"><label>Target selling price (KSh) *</label><input name="targetPrice" type="number" min="0" step="0.01" required/></div><div className="field"><label><input type="checkbox" name="hotSale"/> Mark as Hot Sale</label></div><div className="field"><label>Payment note (optional)</label><textarea name="comment" rows={3}/></div><button className="btn" disabled={uploadBusy || !imageUrl}>Save shoe to inventory</button></form>
          </> : tab === 'analysis' && isSuperAdmin ? <>
            <div className="content-title"><div><div className="eyebrow">MANAGEMENT REPORTING</div><h2>Business analysis</h2><p className="muted">Review stock batches, sales performance and profitability. Cost information is restricted to Super Admin.</p></div></div>
            {(() => { const batches = Array.from(new Set(shoes.map((x) => Number(x.stockType)).filter((x) => Number.isFinite(x) && x > 0))).sort((a,b)=>a-b); const latest = batches.length ? Math.max(...batches) : 0; const filtered = shoes.filter((x) => analysisBatch === 'all' || (analysisBatch === 'latest' ? Number(x.stockType) === latest : Number(x.stockType) !== latest)); const soldSet = filtered.filter((x) => x.status.toLowerCase() === 'sold'); const revenueSet = soldSet.reduce((n,x)=>n+Number(x.priceSold||0),0); const costSet = soldSet.reduce((n,x)=>n+Number(x.buyingPrice||0),0); const profitSet = revenueSet-costSet; const pendingSet = filtered.reduce((n,x)=>n+Number(x.pendingAmount||0),0); const pendingCount = filtered.filter(x=>Number(x.pendingAmount||0)>0).length; return <><div className="analysis-toolbar"><div><label htmlFor="batch-filter">Stock batch filter</label><select id="batch-filter" value={analysisBatch} onChange={(e)=>setAnalysisBatch(e.target.value as 'all'|'latest'|'older')}><option value="all">All stock batches</option><option value="latest">Latest batch · {latest || '—'} (New)</option><option value="older">Older batches (Old)</option></select></div><p className="muted">The highest Stock Type number is always treated as the newest batch.</p></div><div className="stats analysis-stats"><div className="stat"><small>PAIRS IN VIEW</small><strong>{filtered.length}</strong></div><div className="stat"><small>PAIRS SOLD</small><strong>{soldSet.length}</strong></div><div className="stat"><small>SALES REVENUE</small><strong>KSh {revenueSet.toLocaleString('en-KE')}</strong></div><div className="stat"><small>GROSS PROFIT</small><strong>KSh {profitSet.toLocaleString('en-KE')}</strong></div><div className="stat"><small>PENDING PAYMENTS</small><strong>KSh {pendingSet.toLocaleString('en-KE')}</strong><span>{pendingCount} accounts outstanding</span></div></div><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Stock age</th><th>Pairs</th><th>Available</th><th>Reserved</th><th>Sold</th><th>Revenue</th><th>Gross profit</th></tr></thead><tbody>{batches.map((batch)=>{const group=filtered.filter((x)=>Number(x.stockType)===batch);const soldGroup=group.filter((x)=>x.status.toLowerCase()==='sold');const rev=soldGroup.reduce((n,x)=>n+Number(x.priceSold||0),0);const prof=soldGroup.reduce((n,x)=>n+Number(x.priceSold||0)-Number(x.buyingPrice||0),0);return <tr key={batch}><td>{batch}</td><td>{batch===latest?'New · Latest':'Old'}</td><td>{group.length}</td><td>{group.filter(x=>x.status.toLowerCase()==='available').length}</td><td>{group.filter(x=>x.status.toLowerCase()==='reserved').length}</td><td>{soldGroup.length}</td><td>KSh {rev.toLocaleString('en-KE')}</td><td>KSh {prof.toLocaleString('en-KE')}</td></tr>})}</tbody></table></div></>; })()}
          </> : isSuperAdmin ? <>
            <div className="eyebrow">ACCESS CONTROL</div><h2>Administrator accounts</h2><p className="muted">Only the Super Admin can create, change, deactivate or reset administrator accounts. Passwords are stored as salted scrypt hashes in Google Sheets.</p>
            <h3>Add administrator</h3>
            <form onSubmit={createAdmin}>
              <div className="field"><label>Username</label><input name="username" required minLength={2} maxLength={40} pattern="[A-Za-z0-9._-]+" placeholder="new.admin"/></div>
              <div className="field"><label>Administrator email for order alerts</label><input name="email" type="email" placeholder="admin@example.com" required/></div>
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
      <footer className="admin-footer">SHOE STUDIO <span>·</span> OPERATIONS WORKSPACE</footer>
    </main>
  </>;
}
