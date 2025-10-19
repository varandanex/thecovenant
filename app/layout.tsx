import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./(site)/components/site-header";
import { SiteFooter } from "./(site)/components/site-footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-poppins" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.thecovenant.es"),
  title: {
    default: "The Covenant",
    template: "%s | The Covenant"
  },
  description:
    "Blog minimalista inspirado en The Covenant: experiencias inmersivas, relatos oscuros y novedades del colectivo.",
  openGraph: {
    title: "The Covenant",
    description:
      "Explora las últimas crónicas, reportajes y proyectos del colectivo The Covenant en un entorno futurista y elegante.",
    url: "https://www.thecovenant.es",
    siteName: "The Covenant",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "The Covenant",
    description: "Blog de misterio, experiencias inmersivas y narrativa interactiva.",
    creator: "@thecovenantes"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`}>
      <body className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-primary/35 via-transparent to-transparent blur-3xl" />
        <SiteHeader />
        <main className="container-bleed pb-16 pt-32 lg:pt-40">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
