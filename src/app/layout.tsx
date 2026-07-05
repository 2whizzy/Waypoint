import type { Metadata } from "next";
import { Fraunces, Spline_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
});
const splineSans = Spline_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Waypoint — build the application together",
  description:
    "A private, collaborative workspace for building a college application: essays, activities, recommenders, supplementals, and shared accountability.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${splineSans.variable}`}>{children}</body>
    </html>
  );
}
