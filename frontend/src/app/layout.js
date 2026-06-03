import "./globals.css";

export const metadata = {
  title: "AURA | AI Interviewer & Behavioral Analyst",
  description: "An advanced real-time mock interview simulator leveraging computer vision to analyze posture, eye contact, expressions, and technical response structure.",
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full flex flex-col font-sans antialiased text-gray-100 bg-cyber-bg">
        {children}
      </body>
    </html>
  );
}
