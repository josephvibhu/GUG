import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import { Shield } from "lucide-react";
import Link from "next/link";

async function AdminContent() {
  await cookies();
  const user = await getCurrentUser();

  if (!user || (!user.isAdmin && !user.isManager)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center max-w-md mx-auto">
          <Shield className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold">Operator Authorization Required</h2>
          <p className="text-xs text-zinc-400 mt-2 mb-6">
            This dashboard is reserved for the exchange operator. Log in with an account registered with the operator access code.
          </p>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-amber-500 text-black font-bold rounded-xl text-xs hover:bg-amber-400 transition"
          >
            Log in as Operator
          </Link>
        </div>
      </div>
    );
  }

  return <AdminDashboard initialUser={user} />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
          <Navbar />
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-amber-400">
            Verifying operator credentials...
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
