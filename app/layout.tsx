import type { Metadata } from 'next';
import './globals.css';

const title = 'Lotto Lab | 1등까지 시간 돌리기';
const description = '내가 고른 로또 번호를 매주 100장씩 샀다면 1등까지 얼마나 걸릴지 체험하는 확률 시뮬레이터';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'LOTTO LAB — 1등까지 시간을 돌려보세요' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
