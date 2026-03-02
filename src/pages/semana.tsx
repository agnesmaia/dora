import type { GetServerSideProps } from "next";
import { auth } from "@/lib/auth";
import SemanaView from "@/views/SemanaView";
import BottomNav from "@/components/BottomNav";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context);

  if (!session?.user?.id) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: {} };
};

export default function SemanaPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] pb-24 md:pb-0 md:pl-56">
      <SemanaView />
      <BottomNav />
    </main>
  );
}
