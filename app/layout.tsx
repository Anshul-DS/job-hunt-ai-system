import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job-Fit Scorer",
  description: "Gate the dealbreakers in code, score the trade-offs with a model.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
