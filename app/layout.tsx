import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Shoe Studio | Shop & Book', description:'Browse the latest shoe collection and make an enquiry.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
