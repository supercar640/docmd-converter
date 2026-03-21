"use client";

import dynamic from "next/dynamic";

const ConverterApp = dynamic(() => import("@/components/ConverterApp"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-400 text-lg">로딩 중...</p>
    </div>
  ),
});

export default function Page() {
  return <ConverterApp />;
}
