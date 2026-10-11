import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCrmContext } from "@/lib/crm/access";
import { CrmProvider } from "@/components/crm/CrmProvider";
import { CrmShell } from "@/components/crm/CrmShell";

export const metadata: Metadata = {
  title: "Leads CRM · PM Tool",
};

export const dynamic = "force-dynamic";

async function resolveAccess() {
  try {
    return await getCrmContext();
  } catch (error) {
    console.error("CRM access check failed:", error);
    return { ok: false as const, status: 500, error: "Could not reach the database. Please try again." };
  }
}

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const result = await resolveAccess();

  if (!result.ok) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] p-6 font-sans">
        <div className="max-w-sm w-full text-center rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#0F172A] p-8 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">No access to Leads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{result.error}</p>
          <p className="text-xs text-slate-400 mt-1">Ask your business admin to share the Leads module with you.</p>
          <Link
            href="/"
            className="inline-flex mt-6 items-center justify-center h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CrmProvider me={result.ctx}>
      <CrmShell>{children}</CrmShell>
    </CrmProvider>
  );
}
