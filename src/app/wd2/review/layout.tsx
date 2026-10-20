import { requireReviewer } from "@/lib/wd2-auth";

export default async function Wd2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireReviewer();
  return <>{children}</>;
}
