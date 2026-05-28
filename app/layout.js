export const metadata = {
  title: "Üretim İzleme Paneli",
  description: "Gerçek zamanlı makine performans paneli",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
