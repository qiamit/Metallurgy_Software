"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JobsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/analysis?view=jobs");
  }, [router]);

  return null;
}
