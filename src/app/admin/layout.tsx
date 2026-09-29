import { Inter } from "next/font/google";
import AdminShell from "./_components/AdminShell";
import "./admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-admin", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={inter.variable}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
