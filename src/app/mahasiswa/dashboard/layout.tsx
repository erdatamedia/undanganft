import { requireMahasiswa } from "@/lib/mahasiswa-auth";

export default async function MahasiswaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMahasiswa();

  return <div className="min-h-screen bg-[#F8FAF9]">{children}</div>;
}
