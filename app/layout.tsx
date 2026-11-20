import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Bug Tracker',icons:{icon:'/favicon.svg?v=2',shortcut:'/favicon.svg?v=2'},description:'Track pending bugs, update fix status and keep your team in sync.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}

