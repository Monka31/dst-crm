"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { Spinner } from "@/components/ui";

export default function Home() {
  const { session, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [session, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
