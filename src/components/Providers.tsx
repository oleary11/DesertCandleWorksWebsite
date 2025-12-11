"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ModalProvider } from "@/hooks/useModal";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ModalProvider>{children}</ModalProvider>
    </AuthProvider>
  );
}
