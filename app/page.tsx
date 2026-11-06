'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [zoomedPhoto, setZoomedPhoto] = useState<{ src: string; alt: string } | null>(null);
  const lastPhotoTap = useRef(0);

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
  ).sort((a, b) => {
    const rank = (status: string) => status.toLowerCase() === 'available' ? 0 : status.toLowerCase() === 'reserved' ? 1 : 2;
    return rank(a.status) - rank(b.status) || Number(b.hotSale) - Number(a.hotSale);
  }), [shoes, search, category, size, max]);

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    setBusy(true); setMsg(''); const form = new FormData(formElement);
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shoeId: selected.id, name: form.get('name'), phone: form.get('phone'), location: form.get('location'), comment: form.get('comment') }) });
      const raw = await response.text(); let data: any;
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Booking API returned non-JSON (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.message || `Booking failed (HTTP ${response.status}).`);
      setMsg(`Thank you. Your enquiry reference is ${data.orderId}. We will contact you shortly.`);
      formElement.reset();
    } catch (error) { setMsg(error instanceof Error ? error.message : 'Booking failed.'); }
    finally { setBusy(false); }
  }

  return <>
    <header className="topbar"><div className="topbar-in"><div className="brand">SHOE<span>STUDIO.</span></div><div className="top-actions"><a className="linkbtn" href="/admin">Admin portal ↗</a></div></div></header>
    <main className="shell store-shell">
      <div className="collection-heading" id="collection"><div><div className="eyebrow">SHOE STUDIO COLLECTION</div><h2>Shop footwear</h2></div><span className="collection-count">{filtered.length} pairs available to browse</span></div>
      <div className="filters"><input aria-label="Search shoes" placeholder="Search by shoe ID, category or size" value={search} onChange={(e) => setSearch(e.target.value)}/><select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Size" value={size} onChange={(e) => setSize(e.target.value)}><option value="">All sizes</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Maximum price" type="number" placeholder="Max price (KSh)" value={max} onChange={(e) => setMax(e.target.value)}/><button className="btn secondary" onClick={() => { setSearch(''); setCategory(''); setSize(''); setMax(''); }}>Reset</button></div>
      <div className="collection-meta">Browse the latest available pairs. Select a shoe to enquire.</div>
      <div className="grid">{loading ? <div className="empty">Loading current stock…</div> : filtered.length === 0 ? <div className="empty">No shoes match your filters. Please try another search.</div> : filtered.map((shoe) => {
        const currentPrice = shoe.hotSale && shoe.salePrice > 0 && shoe.salePrice < shoe.targetPrice ? shoe.salePrice : shoe.targetPrice;
        const available = shoe.status.toLowerCase() === 'available';
        return <article className="shoe" key={shoe.id}>
          <div className="shoe-photo-wrap" onClick={() => { const now = Date.now(); if (now - lastPhotoTap.current < 360) setZoomedPhoto({ src: shoe.picture || '/images/shoe-placeholder.svg', alt: `${shoe.category} shoe, size ${shoe.size}` }); lastPhotoTap.current = now; }} onDoubleClick={() => setZoomedPhoto({ src: shoe.picture || '/images/shoe-placeholder.svg', alt: `${shoe.category} shoe, size ${shoe.size}` })} role="button" tabIndex={0} aria-label={`Double tap or double click to enlarge ${shoe.category}, size ${shoe.size}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setZoomedPhoto({ src: shoe.picture || '/images/shoe-placeholder.svg', alt: `${shoe.category} shoe, size ${shoe.size}` }); }}>
            <img loading="lazy" referrerPolicy="no-referrer" src={shoe.picture || '/images/shoe-placeholder.svg'} alt={`${shoe.category} shoe, size ${shoe.size}`} onError={(event) => { const img = event.currentTarget; if (img.dataset.fallback !== 'used' && shoe.originalPicture) { img.dataset.fallback = 'used'; img.src = shoe.originalPicture; } else img.src = '/images/shoe-placeholder.svg'; }}/>
            <span className="zoom-hint">Double-tap to zoom</span>{shoe.hotSale && <span className="hot-sale-badge">HOT SALE</span>}
          </div>
          <div className="shoe-body"><span className={`pill ${shoe.status}`}>{shoe.status}</span><h3>{shoe.category || 'Shoe'} · Size {shoe.size}</h3><div className="muted">Item {shoe.id}</div><div className="price">{currentPrice < shoe.targetPrice && <span className="old-price">KSh {shoe.targetPrice.toLocaleString('en-KE')}</span>}KSh {currentPrice.toLocaleString('en-KE')}</div><button className="btn" style={{ width: '100%' }} disabled={!available} onClick={() => { setSelected(shoe); setMsg(''); }}>{available ? 'Enquire / Book' : shoe.status.toLowerCase() === 'reserved' ? 'Currently reserved' : 'Sold'}</button></div>
        </article>;
      })}</div>
      <footer className="footer">© {new Date().getFullYear()} Shoe Studio. Prices and availability are subject to confirmation.</footer>
    </main>
    {zoomedPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Enlarged product photo" onClick={() => setZoomedPhoto(null)}><button className="lightbox-close" onClick={() => setZoomedPhoto(null)} aria-label="Close enlarged photo">×</button><img src={zoomedPhoto.src} alt={zoomedPhoto.alt} onClick={(event) => event.stopPropagation()}/><span>Tap anywhere outside the photo to close</span></div>}
    {selected && <div className="modal" role="dialog" aria-modal="true"><div className="modal-card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Enquire about this pair</h2><button className="btn secondary" onClick={() => setSelected(null)}>Close</button></div><p className="muted">{selected.id} · Size {selected.size} · KSh {(selected.hotSale && selected.salePrice > 0 && selected.salePrice < selected.targetPrice ? selected.salePrice : selected.targetPrice).toLocaleString('en-KE')}</p>{msg && <div className="notice">{msg}</div>}<form onSubmit={book}><div className="field"><label>Your name *</label><input name="name" required maxLength={100}/></div><div className="field"><label>Phone number *</label><input name="phone" required maxLength={30} placeholder="e.g. 07xx xxx xxx"/></div><div className="field"><label>Location</label><input name="location" maxLength={160}/></div><div className="field"><label>Message</label><textarea name="comment" rows={3} maxLength={1000}/></div><button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Submitting…' : 'Send enquiry'}</button></form></div></div>}
  </>;
}
