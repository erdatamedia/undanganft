import { requireWd2 } from "@/lib/wd2-auth";

export default async function Wd2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWd2();

  return <div className="min-h-screen bg-[#F8FAF9]">{children}</div>;
}
