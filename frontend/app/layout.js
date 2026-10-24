import "./globals.css";

export const metadata = {
  title: {
    default: "Vi Vu | Đi thật xa, chạm thật gần",
    template: "%s | Vi Vu",
  },
  description: "Khám phá những hành trình du lịch đáng nhớ khắp Việt Nam cùng Vi Vu.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
