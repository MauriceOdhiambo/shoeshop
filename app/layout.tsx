import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Shoe Studio | Footwear, thoughtfully selected', description:'Discover your next pair at Shoe Studio. Browse footwear, check availability and enquire directly.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
