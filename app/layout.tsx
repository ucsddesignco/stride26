import './globals.css';
import localFont from 'next/font/local';

const nbInternational = localFont({
  src: '../public/fonts/NB International Regular Webfont.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-nb-international',
  display: 'swap',
});

const neuePlak = localFont({
  src: '../public/fonts/neue-plak/Neue Plak W05 Extended Bold.woff2',
  weight: '700',
  style: 'normal',
  variable: '--font-neue-plak',
  display: 'swap',
});

const neuePlakRegular = localFont({
  src: '../public/fonts/neue-plak/Neue Plak Regular.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-neue-plak-regular',
  display: 'swap',
});


export const metadata = {
  title: 'Stride Base Layout',
  description: 'Built with Next.js and Tailwind CSS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${nbInternational.variable} ${neuePlak.variable} ${neuePlakRegular.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}