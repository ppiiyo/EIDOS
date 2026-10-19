import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'kostra44SIP — Semantic Recommender Engine',
    template: '%s | kostra44SIP',
  },
  description: 'High-performance semantic recommendation and vector search engine for marketplaces, digital libraries & streaming platforms. Eliminates cold-start item starvation via 384-dimensional dense vector embeddings.',
  keywords: [
    'semantic search',
    'vector database',
    'recommendation engine',
    'HNSW',
    'MMR',
    'open source',
    'WASM',
    'in-browser',
  ],
  authors: [{ name: 'kostra44SIP Team' }],
  creator: 'kostra44SIP Team',
  publisher: 'kostra44SIP',
  metadataBase: new URL('https://kostra44sip.dev'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://kostra44sip.dev',
    siteName: 'kostra44SIP',
    title: 'kostra44SIP — Real-Time Semantic Affinity Engine',
    description: 'Eliminates cold-start item starvation via 384-dimensional dense vector embeddings and Shannon entropy diversity re-ranking.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'kostra44SIP — Semantic Recommender Engine',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'kostra44SIP — Semantic Recommender Engine',
    description: 'High-performance semantic recommendation and vector search engine.',
    images: ['/og-image.png'],
    creator: '@kostra44sip_dev',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://kostra44sip.dev',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
