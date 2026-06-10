import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      <Sidebar />
      <main className="ml-60 min-h-screen p-8 max-w-[1440px]">
        {children}
      </main>
    </div>
  );
}
