import "./globals.css";
export const metadata = {
  title: 'Тёмный мир',
  description: 'Каркас игры',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
