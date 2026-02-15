
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Verifair | AI-Powered Bias Detection Platform",
  description: "Detect, visualize, and report on sociotechnical bias in text and data using research-backed AI models.",
  keywords: "AI, bias detection, hate speech, stereotypes, fairness, NLP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <PageTransition>{children}</PageTransition>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
