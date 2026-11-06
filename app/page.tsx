'use client';
import { useEffect, useMemo, useState } from 'react';

type Shoe = { id: string; picture: string; originalPicture?: string; size: string | number; targetPrice: number; salePrice: number; hotSale: boolean; status: string; category: string; stockType: number };

export default function Home() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [max, setMax] = useState('');
  const [selected, setSelected] = useState<Shoe | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory', { cache: 'no-store' });
      const raw = await response.text(); let data: any;
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Inventory API returned non-JSON (HTTP ${response.status}).`); }
      if (!response.ok || !data.success) throw new Error(data.message || `Could not load inventory (HTTP ${response.status}).`);
      setShoes(Array.isArray(data.shoes) ? data.shoes : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setSizes(Array.isArray(data.sizes) ? data.sizes : []);
    } catch (error) { setMsg(error instanceof Error ? error.message : 'Could not connect to inventory.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => shoes.filter((shoe) =>
    (!search || `${shoe.id} ${shoe.category} ${shoe.size}`.toLowerCase().includes(search.toLowerCase())) &&
    (!category || shoe.category === category) && (!size || String(shoe.size) === size) &&
    (!max || (shoe.hotSale && shoe.salePrice > 0 && shoe.salePrice < shoe.targetPrice ? shoe.salePrice : shoe.targetPrice) <= Number(max))
  ), [shoes, search, category, size, max]);

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setMsg(''); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shoeId: selected.id, name: form.get('name'), phone: form.get('phone'), location: form.get('location'), comment: form.get('comment') }) });
      const raw = await response.text(); let data: any;
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Booking API returned non-JSON (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.message || `Booking failed (HTTP ${response.status}).`);
      setMsg(`Thank you. Your enquiry reference is ${data.orderId}. We will contact you shortly.`);
      (event.currentTarget as HTMLFormElement).reset();
    } catch (error) { setMsg(error instanceof Error ? error.message : 'Booking failed.'); }
    finally { setBusy(false); }
  }

  return <>
    <header className="topbar"><div className="topbar-in"><div className="brand">SHOE<span>STUDIO.</span></div><div className="top-actions"><a className="linkbtn" href="/admin">Admin portal ↗</a></div></div></header>
    <main className="shell">
      <section className="hero"><div className="eyebrow">The latest collection</div><h1>Find your next favourite pair.</h1><p>Explore available styles, compare sizes and prices, and send us an enquiry for a pair you love. Available shoes are shown first.</p></section>
      <div className="filters"><input aria-label="Search shoes" placeholder="Search by shoe ID, category or size" value={search} onChange={(e) => setSearch(e.target.value)}/><select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)}><option value="">All sizes</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Maximum price" type="number" placeholder="Max price (KSh)" value={max} onChange={(e) => setMax(e.target.value)}/><button className="btn secondary" onClick={() => { setSearch(''); setCategory(''); setSize(''); setMax(''); }}>Reset</button></div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Shop collection · {filtered.length} items · Available first</div>
      <div className="grid">{loading ? <div className="empty">Loading current stock…</div> : filtered.length === 0 ? <div className="empty">No shoes match your filters. Please try another search.</div> : filtered.map((shoe) => {
        const currentPrice = shoe.hotSale && shoe.salePrice > 0 && shoe.salePrice < shoe.targetPrice ? shoe.salePrice : shoe.targetPrice;
        const available = shoe.status.toLowerCase() === 'available';
        return <article className="shoe" key={shoe.id}>
          <div className="shoe-photo-wrap"><img loading="lazy" referrerPolicy="no-referrer" src={shoe.picture || '/images/shoe-placeholder.svg'} alt={`${shoe.category} shoe, size ${shoe.size}`} onError={(event) => { const img = event.currentTarget; if (img.dataset.fallback !== 'used' && shoe.originalPicture) { img.dataset.fallback = 'used'; img.src = shoe.originalPicture; } else img.src = '/images/shoe-placeholder.svg'; }}/>{shoe.hotSale && <span className="hot-sale-badge">HOT SALE</span>}</div>
          <div className="shoe-body"><span className={`pill ${shoe.status}`}>{shoe.status}</span><h3>{shoe.category || 'Shoe'} · Size {shoe.size}</h3><div className="muted">Item {shoe.id}</div><div className="price">{currentPrice < shoe.targetPrice && <span className="old-price">KSh {shoe.targetPrice.toLocaleString('en-KE')}</span>}KSh {currentPrice.toLocaleString('en-KE')}</div><button className="btn" style={{ width: '100%' }} disabled={!available} onClick={() => { setSelected(shoe); setMsg(''); }}>{available ? 'Enquire / Book' : shoe.status.toLowerCase() === 'reserved' ? 'Currently reserved' : 'Sold'}</button></div>
        </article>;
      })}</div>
      <footer className="footer">© {new Date().getFullYear()} Shoe Studio. Prices and availability are subject to confirmation.</footer>
    </main>
    {selected && <div className="modal" role="dialog" aria-modal="true"><div className="modal-card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Enquire about this pair</h2><button className="btn secondary" onClick={() => setSelected(null)}>Close</button></div><p className="muted">{selected.id} · Size {selected.size} · KSh {(selected.hotSale && selected.salePrice > 0 && selected.salePrice < selected.targetPrice ? selected.salePrice : selected.targetPrice).toLocaleString('en-KE')}</p>{msg && <div className="notice">{msg}</div>}<form onSubmit={book}><div className="field"><label>Your name *</label><input name="name" required maxLength={100}/></div><div className="field"><label>Phone number *</label><input name="phone" required maxLength={30} placeholder="e.g. 07xx xxx xxx"/></div><div className="field"><label>Location</label><input name="location" maxLength={160}/></div><div className="field"><label>Message</label><textarea name="comment" rows={3} maxLength={1000}/></div><button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Submitting…' : 'Send enquiry'}</button></form></div></div>}
  </>;
}
