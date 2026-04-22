import "./globals.css";

export const metadata = {
  title: "Closet Daily",
  description: "Capture your wardrobe, clean product photos, and build outfits with Better Auth on Next.js.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
