import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PromptXP — prompt control plane",
  description:
    "A local, prompt-native control plane for AI coding agents. Every prompt, skill and MCP server on your machine, in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sans.variable} ${mono.variable} ${display.variable} grain min-h-screen antialiased`}
      >
        <TooltipProvider>
          <Shell>{children}</Shell>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
