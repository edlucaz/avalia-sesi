"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { lerSessao } from "@/lib/session";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(lerSessao() ? "/simulados" : "/login");
  }, [router]);

  return null;
}
