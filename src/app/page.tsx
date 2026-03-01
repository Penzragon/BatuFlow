"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Redirecting...</p>
    </div>
  );
}

RootRedirect.displayName = "RootRedirect";
export default RootRedirect;
