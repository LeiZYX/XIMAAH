"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/fees/money";
import { shouldShowExchangeRate } from "@/lib/fees/display-currency";
import "@/styles/fee-print.css";

const PARTNERSHIP_LOGO = "/logos/shssip-rugby-logo.png";

export interface FeeStatementPrintData {
  id: string;
  statementNo: string;
  displayCurrency: "GBP" | "CNY" | "BOTH";
  exchangeRateSnapshot: number | string | null;
  studentNameSnapshot: string;
  studentNoSnapshot: string;
  gradeSnapshot: string;
  classNameSnapshot: string;
  emailSnapshot: string | null;
  assessmentHubCandidateNumberSnapshot?: string | null;
  candidateTypeSnapshot?: string | null;
  status: string;
  totalGbpAmount: number | string;
  totalCnyAmount: number | string;
  paymentNotes?: string | null;
  generatedAt: string;
  issuedAt: string | null;
  registrationWindow: {
    title: string;
    examBoard: { name: string; code: string };
    examSeries: { name: string; year: number };
  };
  items: Array<{
    examBoardSnapshot: string;
    qualificationSnapshot: string;
    subjectSnapshot: string;
    paperCodeSnapshot: string;
    paperTitleSnapshot: string;
    entryTypeSnapshot: string;
    salesGbpAmountSnapshot: number | string;
    salesCnyAmountSnapshot: number | string;
    lineTotalGbp: number | string;
    lineTotalCny: number | string;
    quantity: number;
    exchangeRateSnapshot?: number | string | null;
  }>;
}

interface FeeStatementPrintModalProps {
  statements: FeeStatementPrintData[];
  displayCurrency: "GBP" | "CNY" | "BOTH";
  onClose: () => void;
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />
    </svg>
  );
}

export function FeeStatementPrintButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Print fee statement" title="Print fee statement" className={className ?? "rounded-lg p-2 text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50"}>
      <PrintIcon className="h-4 w-4" />
    </button>
  );
}

function StatementDocument({
  statement,
  displayCurrency,
  printDate,
}: {
  statement: FeeStatementPrintData;
  displayCurrency: "GBP" | "CNY" | "BOTH";
  printDate: string;
}) {
  const totalGbp = Number(statement.totalGbpAmount);
  const totalCny = Number(statement.totalCnyAmount);
  const rate = statement.exchangeRateSnapshot ? Number(statement.exchangeRateSnapshot) : null;
  const isInternal = statement.candidateTypeSnapshot === "INTERNAL";

  return (
    <article className="fee-print-document">
      <header className="fee-print-header registration-print-keep-together">
        <div className="flex items-start justify-between gap-4">
          <Image src={PARTNERSHIP_LOGO} alt="SHSSIP in partnership with Rugby School" width={220} height={64} className="h-14 w-auto object-contain" />
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">XIMA Assessment Hub</p>
            <p>Exam Fee Statement</p>
            <p>Statement No. {statement.statementNo}</p>
            <p>Print date: {printDate}</p>
          </div>
        </div>
      </header>

      <section className="fee-print-body mt-6 space-y-6 text-sm">
        <div className="registration-print-keep-together grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate information</h2>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">Name: </dt><dd className="inline">{statement.studentNameSnapshot}</dd></div>
              {statement.assessmentHubCandidateNumberSnapshot ? (
                <div><dt className="inline font-medium">Assessment Hub candidate no.: </dt><dd className="inline">{statement.assessmentHubCandidateNumberSnapshot}</dd></div>
              ) : null}
              {statement.candidateTypeSnapshot ? (
                <div><dt className="inline font-medium">Candidate type: </dt><dd className="inline">{statement.candidateTypeSnapshot === "INTERNAL" ? "Internal" : "External"}</dd></div>
              ) : null}
              {isInternal ? (
                <>
                  <div><dt className="inline font-medium">Student no.: </dt><dd className="inline">{statement.studentNoSnapshot}</dd></div>
                  <div><dt className="inline font-medium">Grade: </dt><dd className="inline">{statement.gradeSnapshot}</dd></div>
                  <div><dt className="inline font-medium">Class: </dt><dd className="inline">{statement.classNameSnapshot}</dd></div>
                </>
              ) : null}
              {statement.emailSnapshot ? (
                <div><dt className="inline font-medium">Email: </dt><dd className="inline">{statement.emailSnapshot}</dd></div>
              ) : null}
            </dl>
          </div>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Registration information</h2>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">Window: </dt><dd className="inline">{statement.registrationWindow.title}</dd></div>
              <div><dt className="inline font-medium">Exam board: </dt><dd className="inline">{statement.registrationWindow.examBoard.name}</dd></div>
              <div><dt className="inline font-medium">Exam series: </dt><dd className="inline">{statement.registrationWindow.examSeries.name} ({statement.registrationWindow.examSeries.year})</dd></div>
              <div><dt className="inline font-medium">Status: </dt><dd className="inline">{statement.status}</dd></div>
              <div><dt className="inline font-medium">Generated: </dt><dd className="inline">{new Date(statement.generatedAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        </div>

        <table className="fee-print-table registration-print-table w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
              <th className="py-2 pr-2">Board</th>
              <th className="py-2 pr-2">Subject</th>
              <th className="py-2 pr-2">Paper</th>
              <th className="py-2 pr-2">Title</th>
              <th className="py-2 pr-2">Entry</th>
              {displayCurrency === "BOTH" ? (
                <>
                  <th className="py-2 pr-2 text-right">GBP Unit</th>
                  <th className="py-2 pr-2 text-right">GBP Total</th>
                  <th className="py-2 pr-2 text-right">CNY Unit</th>
                  <th className="py-2 pr-2 text-right">CNY Total</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                </>
              ) : (
                <>
                  <th className="py-2 pr-2 text-right">Unit price</th>
                  <th className="py-2 pr-2">Currency</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Line total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {statement.items.map((item, index) => {
              const unitGbp = Number(item.salesGbpAmountSnapshot);
              const unitCny = Number(item.salesCnyAmountSnapshot);
              const lineGbp = Number(item.lineTotalGbp);
              const lineCny = Number(item.lineTotalCny);
              const itemRate = item.exchangeRateSnapshot ? Number(item.exchangeRateSnapshot) : rate;

              return (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{item.examBoardSnapshot}</td>
                  <td className="py-2 pr-2">{item.subjectSnapshot}</td>
                  <td className="py-2 pr-2">{item.paperCodeSnapshot}</td>
                  <td className="py-2 pr-2">{item.paperTitleSnapshot}</td>
                  <td className="py-2 pr-2">{item.entryTypeSnapshot}</td>
                  {displayCurrency === "BOTH" ? (
                    <>
                      <td className="py-2 pr-2 text-right">{formatMoney(unitGbp, "GBP")}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(lineGbp, "GBP")}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(unitCny, "CNY")}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(lineCny, "CNY")}</td>
                      <td className="py-2 pr-2 text-right">{itemRate ?? "—"}</td>
                    </>
                  ) : displayCurrency === "GBP" ? (
                    <>
                      <td className="py-2 pr-2 text-right">{formatMoney(unitGbp, "GBP")}</td>
                      <td className="py-2 pr-2">GBP</td>
                      <td className="py-2 pr-2 text-right">{item.quantity}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(lineGbp, "GBP")}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2 text-right">{formatMoney(unitCny, "CNY")}</td>
                      <td className="py-2 pr-2">CNY</td>
                      <td className="py-2 pr-2 text-right">{item.quantity}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(lineCny, "CNY")}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="registration-print-keep-together rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
          <dl className="space-y-1 text-sm">
            {(displayCurrency === "GBP" || displayCurrency === "BOTH") ? (
              <div><dt className="inline font-medium">Total GBP: </dt><dd className="inline">{formatMoney(totalGbp, "GBP")}</dd></div>
            ) : null}
            {(displayCurrency === "CNY" || displayCurrency === "BOTH") ? (
              <div><dt className="inline font-medium">Total CNY: </dt><dd className="inline">{formatMoney(totalCny, "CNY")}</dd></div>
            ) : null}
            {shouldShowExchangeRate(displayCurrency) && rate ? (
              <div><dt className="inline font-medium">Exchange rate snapshot: </dt><dd className="inline">1 GBP = {rate} CNY</dd></div>
            ) : null}
            {statement.paymentNotes ? (
              <div><dt className="inline font-medium">Payment notes: </dt><dd className="inline">{statement.paymentNotes}</dd></div>
            ) : null}
          </dl>
        </div>

        <footer className="fee-print-footer text-xs text-slate-600">
          <p>This fee statement is generated based on the final locked exam registration.</p>
          <p>If any information is incorrect, please contact the Exams Office.</p>
        </footer>
      </section>
    </article>
  );
}

export function FeeStatementPrintModal({ statements, displayCurrency, onClose }: FeeStatementPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const printDate = useMemo(() => new Date().toLocaleDateString(), []);

  useEffect(() => setMounted(true), []);

  const handlePrint = useCallback(() => {
    document.body.classList.add("fee-print-active");
    window.print();
    window.setTimeout(() => document.body.classList.remove("fee-print-active"), 500);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 print:hidden">
        <div className="my-8 w-full max-w-5xl rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Print fee statement{statements.length > 1 ? "s" : ""}</h2>
              <p className="text-sm text-slate-600">{statements.length} document{statements.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handlePrint} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Print</button>
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Close</button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-6">
            {statements.map((statement) => (
              <div key={statement.id} className="mb-8 border border-slate-200 p-6 last:mb-0">
                <StatementDocument statement={statement} displayCurrency={displayCurrency} printDate={printDate} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="fee-print-clone" className="hidden print:block">
        {statements.map((statement, index) => (
          <div key={statement.id} className={index < statements.length - 1 ? "fee-print-page-break" : ""}>
            <StatementDocument statement={statement} displayCurrency={displayCurrency} printDate={printDate} />
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
