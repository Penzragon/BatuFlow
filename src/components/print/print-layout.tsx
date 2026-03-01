"use client";

import React from "react";

const DEFAULT_COMPANY_NAME = "BatuFlow";

interface PrintLayoutProps {
  children: React.ReactNode;
  companyName?: string;
  title?: string;
  /** Optional footer text (e.g. "Thank you for your business") */
  footer?: string;
}

/**
 * Wrapper for print-friendly pages. Hides navigation and applies clean print styles.
 * Use with @media print: no sidebar, minimal margins, monochrome-friendly.
 */
export function PrintLayout({
  children,
  companyName = DEFAULT_COMPANY_NAME,
  title,
  footer,
}: PrintLayoutProps) {
  return (
    <div className="print-layout min-h-screen bg-white p-6">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-layout { padding: 0; }
          .print-hide { display: none !important; }
          .print-layout .print-header { margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
          .print-layout .print-footer { margin-top: 1.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #6b7280; }
          .print-layout table { width: 100%; border-collapse: collapse; }
          .print-layout th, .print-layout td { border: 1px solid #e5e7eb; padding: 0.375rem 0.5rem; text-align: left; font-size: 0.875rem; }
          .print-layout th { background: #f3f4f6; font-weight: 600; }
        }
      `}</style>
      <header className="print-header">
        <h1 className="text-lg font-semibold text-gray-900">{companyName}</h1>
        {title && <p className="text-sm text-gray-600 mt-0.5">{title}</p>}
      </header>
      <main className="print-content">{children}</main>
      {footer && (
        <footer className="print-footer">{footer}</footer>
      )}
    </div>
  );
}
