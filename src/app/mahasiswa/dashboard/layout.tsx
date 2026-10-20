import { requireMahasiswa } from "@/lib/mahasiswa-auth";

export default async function MahasiswaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMahasiswa();
  return <>{children}</>;
}
