
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Verifair — Bias Audit Platform",
  description: "Detect, visualize, and report on bias in text and data using Vector Embeddings, Z-Score Analysis, and Fairness Metrics.",
  keywords: "bias audit, NLP, vector embeddings, fairness metrics, hate speech detection, semantic analysis",
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
