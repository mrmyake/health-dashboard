import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gezondheid",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <div className="shell">
          <nav className="nav">
            <span className="brand">Gezondheid</span>
            <Link className="tab" href="/">Overzicht</Link>
            <Link className="tab" href="/bloeddruk">Bloeddruk</Link>
            <Link className="tab" href="/training">Training</Link>
            <Link className="tab" href="/labs">Bloedwaardes</Link>
            <Link className="tab" href="/events">Interventies</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
