import type { GetServerSideProps } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/LoginForm";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context);

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profile: true },
    });

    if (!user?.profile) {
      return { redirect: { destination: "/onboarding", permanent: false } };
    }
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return { props: {} };
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F5EFE6] flex flex-col mx-auto items-center">
      <LoginForm />
    </main>
  );
}
