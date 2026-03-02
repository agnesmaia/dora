import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";

const TABS = [
  { href: "/dashboard", label: "Hoje", icon: "today" },
  { href: "/semana", label: "Semana", icon: "calendar_view_week" },
  { href: "/simulate", label: "Simular", icon: "bolt" },
];

export default function BottomNav() {
  const { pathname } = useRouter();

  return (
    <>
      {/* ── Mobile: barra inferior ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8D9C5] shadow-[0_-4px_24px_rgba(124,92,62,0.06)]">
        <div className="flex items-center justify-around px-2 pt-2 pb-6">
          {TABS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 px-6 py-1 relative"
              >
                {active && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#7C5C3E] rounded-full" />
                )}
                <span
                  className={`material-symbols-outlined transition-colors text-[22px] leading-none ${
                    active ? "text-[#7C5C3E]" : "text-[#A08060]"
                  }`}
                  style={{
                    fontVariationSettings: `'wght' ${active ? 400 : 300}`,
                  }}
                >
                  {icon}
                </span>
                <span
                  className={`text-[10px] font-semibold transition-colors ${
                    active ? "text-[#7C5C3E]" : "text-[#A08060]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Desktop: sidebar lateral ── */}
      <nav className="hidden md:flex fixed top-0 left-0 bottom-0 z-50 w-56 bg-white border-r border-[#E8D9C5] flex-col pt-10 pb-8 shadow-[4px_0_24px_rgba(124,92,62,0.04)]">
        {/* Logo */}
        <div className="flex items-center justify-center px-5">
          <Image
            src="/assets/logo.svg"
            alt="Dora"
            width={500}
            height={12}
            style={{
              filter:
                "invert(38%) sepia(19%) saturate(836%) hue-rotate(349deg) brightness(89%) contrast(88%)",
            }}
          />
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-1 px-3">
          {TABS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  active
                    ? "bg-[#F5EFE6] text-[#7C5C3E]"
                    : "text-[#A08060] hover:bg-[#FAF7F2] hover:text-[#7C5C3E]"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px] leading-none"
                  style={{
                    fontVariationSettings: `'wght' ${active ? 400 : 300}`,
                  }}
                >
                  {icon}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
