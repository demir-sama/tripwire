import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet";
import { Nav, Footer, ConnectModal } from "@/components/Chrome";
import { TripOverlay } from "@/components/TripOverlay";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tripwire-sama-5806.vercel.app"),
  title: "Tripwire — meme tokens with rules that bite",
  description: "Launch a meme token on NEAR whose buy and sell limits, max wallet, fee and liquidity lock are enforced by the contract. Try to rug it. Watch it trip.",
  openGraph: { title: "Tripwire", description: "The joke needs rules. Meme tokens on NEAR where rug pulls fail on-chain.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="grain min-h-screen">
        <WalletProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
          <ConnectModal />
          <TripOverlay />
        </WalletProvider>
      </body>
    </html>
  );
}
