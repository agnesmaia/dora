import type { GetServerSideProps } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DashboardView from "@/views/DashboardView";
import BottomNav from "@/components/BottomNav";
import type { AtividadeCustom } from "@/pages/api/onboarding/gpt";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context);

  if (!session?.user?.id) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profile: true, name: true, atividadesCustom: true },
  });

  if (!user?.profile) {
    return {
      redirect: { destination: "/onboarding/descricao", permanent: false },
    };
  }

  return {
    props: {
      userName: user.name ?? null,
      atividadesCustom:
        (user.atividadesCustom as unknown as AtividadeCustom[]) ?? null,
    },
  };
};

export default function Dashboard({
  userName,
  atividadesCustom,
}: {
  userName: string | null;
  atividadesCustom: AtividadeCustom[] | null;
}) {
  return (
    <main className="min-h-screen bg-[#FAF7F2] pb-24 md:pb-0 md:pl-56">
      <DashboardView userName={userName} atividadesCustom={atividadesCustom} />
      <BottomNav />
    </main>
  );
}
