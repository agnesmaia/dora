import type { GetServerSideProps } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SemanaView from "@/views/SemanaView";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context);

  if (!session?.user?.id) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profile: true },
  });

  if (!user?.profile) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  return { props: {} };
};

export default function RotinaPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <SemanaView />
    </main>
  );
}
