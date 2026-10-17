"use client";

import Image from "next/image";
import Link from "next/link";

import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

import { LoginFormDashboard } from "./_components/login-form-dashboard";

export default function LoginPage() {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes flicker {
          0% { transform: scaleY(1) scaleX(1); opacity: 0.8; }
          100% { transform: scaleY(1.3) scaleX(0.8); opacity: 1; }
        }
      `}</style>

      <div className="mx-auto flex w-full flex-col items-center justify-center gap-6 px-4 sm:w-[380px]">
        {/* ELI Bot with rocket fire */}
        <div className="relative flex flex-col items-center">
          <div className="absolute -bottom-4 h-16 w-20 rounded-full bg-orange-500/20 blur-2xl animate-pulse" />
          <div className="absolute -bottom-2 h-10 w-12 rounded-full bg-amber-400/30 blur-xl animate-pulse" />
          <div className="absolute -bottom-6 flex items-center justify-center gap-0.5">
            <div
              className="h-8 w-1.5 rounded-full bg-gradient-to-t from-transparent via-orange-500 to-amber-300 opacity-90"
              style={{ animation: "flicker 0.15s ease-in-out infinite alternate" }}
            />
            <div
              className="h-10 w-2 rounded-full bg-gradient-to-t from-transparent via-orange-400 to-yellow-200 opacity-95"
              style={{ animation: "flicker 0.12s ease-in-out infinite alternate" }}
            />
            <div
              className="h-12 w-2.5 rounded-full bg-gradient-to-t from-transparent via-orange-500 to-amber-200"
              style={{ animation: "flicker 0.1s ease-in-out infinite alternate" }}
            />
            <div
              className="h-10 w-2 rounded-full bg-gradient-to-t from-transparent via-orange-400 to-yellow-200 opacity-95"
              style={{ animation: "flicker 0.13s ease-in-out infinite alternate" }}
            />
            <div
              className="h-8 w-1.5 rounded-full bg-gradient-to-t from-transparent via-orange-500 to-amber-300 opacity-90"
              style={{ animation: "flicker 0.16s ease-in-out infinite alternate" }}
            />
          </div>
          <div className="relative z-10" style={{ animation: "float 3s ease-in-out infinite" }}>
            <Image src="/eli-bot.webp" alt="ELI Bot" width={120} height={120} className="drop-shadow-2xl" priority />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 text-center pt-2">
          <h1 className="font-semibold text-2xl tracking-tight">Iniciar sesión</h1>
          <p className="text-muted-foreground text-sm">Ingresá tus credenciales para acceder al panel.</p>
        </div>

        {/* Form */}
        <div className="w-full">
          <LoginFormDashboard />
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-6 sm:px-10">
        <p className="text-muted-foreground text-sm">
          ¿Problemas para entrar?{" "}
          <Link
            prefetch={false}
            className="text-foreground underline underline-offset-4 hover:no-underline"
            href="/login"
          >
            Contactar soporte
          </Link>
        </p>
      </div>

      <div className="absolute bottom-5 flex w-full items-center justify-between px-6 sm:px-10">
        <div className="text-muted-foreground text-sm">{APP_CONFIG.copyright}</div>
        <div className="flex items-center gap-2">
          <img src="/mano-gr.svg" alt="MA-NO" className="h-5 w-auto opacity-40 hover:opacity-70 transition-opacity" />
          <span className="flex items-center gap-1 text-muted-foreground text-sm">
            <Globe className="size-4" />
            ES
          </span>
        </div>
      </div>
    </>
  );
}
