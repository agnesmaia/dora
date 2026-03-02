"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-full flex flex-col px-8 pt-20 pb-10 bg-[#F5EFE6] min-w-sm">
      {/* Logo Section */}
      <div className="flex flex-col items-center mt-8 mb-12">
        <Image
          src="/assets/logo.svg"
          alt="Dora — Do Routine Adaptively"
          width={280}
          height={120}
          priority
          className="mb-2"
          style={{
            filter:
              "invert(38%) sepia(19%) saturate(836%) hue-rotate(349deg) brightness(89%) contrast(88%)",
          }}
        />
      </div>

      {/* Form Section */}
      <div className="w-full space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#2C1810] ml-1">
            Email
          </label>
          <input
            type="email"
            placeholder="seu@email.com"
            className="w-full px-4 py-3.5 rounded-2xl bg-white border border-[#E8D9C5] focus:border-[#7C5C3E] focus:ring-2 focus:ring-[#7C5C3E]/15 outline-none transition-all placeholder:text-[#C4A882] text-[#2C1810]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#2C1810] ml-1">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-[#E8D9C5] focus:border-[#7C5C3E] focus:ring-2 focus:ring-[#7C5C3E]/15 outline-none transition-all placeholder:text-[#C4A882] text-[#2C1810]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C4A882] hover:text-[#7C5C3E] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="text-sm font-medium text-[#7C5C3E] hover:text-[#5C3D22]">
            Esqueceu a senha?
          </button>
        </div>

        <button className="w-full py-4 rounded-2xl bg-[#7C5C3E] text-white font-bold text-lg shadow-lg shadow-[#7C5C3E]/20 hover:bg-[#5C3D22] active:scale-[0.98] transition-all">
          Entrar
        </button>
      </div>

      {/* Social Login */}
      <div className="mt-8">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-x-0 h-px bg-[#E8D9C5]"></div>
          <span className="relative bg-[#F5EFE6] px-4 text-sm text-[#7A6050] font-medium">
            ou continue com
          </span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-full py-3.5 rounded-2xl bg-white border border-[#E8D9C5] text-[#2C1810] font-semibold flex items-center justify-center gap-3 hover:bg-[#FAF7F2] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 text-center">
        <p className="text-[#7A6050] text-sm">
          Não tem conta?{" "}
          <button className="text-[#7C5C3E] font-bold hover:underline">
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}
