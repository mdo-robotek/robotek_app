"use client";

import { ReactNode, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AccessGuard from "@/components/AccessGuard";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div style={{ background: 'var(--background)' }} className="h-screen flex overflow-hidden">
      <Sidebar mobileOpen={isMobileMenuOpen} setMobileOpen={setIsMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-h-0 ml-0 md:ml-60 overflow-hidden">
        {/* Header — light, with the page greeting */}
        <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        {/* Content panel — light grey background */}
        <div style={{ backgroundColor: 'var(--panel-bg)' }} className="flex-1 flex flex-col min-h-0">
          <main className="flex-1 p-2 md:p-4 overflow-y-auto w-full min-w-0 custom-scrollbar">
            <div className="w-full max-w-full mx-auto">
              <AccessGuard>
                {children}
              </AccessGuard>
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
