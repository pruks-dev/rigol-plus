import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ψ-RigolPlus",
  description: "Remote RIGOL DHO814 & DG822 Pro — WebUSB Bridge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
