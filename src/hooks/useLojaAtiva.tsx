import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Loja {
  id: string;
  nome: string;
  endereco: string | null;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
}

interface LojaContextType {
  lojaAtiva: Loja | null;
  lojas: Loja[];
  setLojaAtivaId: (id: string) => void;
  loading: boolean;
}

const LojaContext = createContext<LojaContextType>({
  lojaAtiva: null,
  lojas: [],
  setLojaAtivaId: () => {},
  loading: true,
});

export function LojaProvider({ children }: { children: ReactNode }) {
  const [lojaAtivaId, setLojaAtivaId] = useState<string | null>(() => {
    return localStorage.getItem("loja_ativa_id");
  });

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").order("nome");
      if (error) throw error;
      return data as Loja[];
    },
  });

  // Auto-select first loja if none selected
  useEffect(() => {
    if (!isLoading && lojas.length > 0 && !lojaAtivaId) {
      const firstId = lojas[0].id;
      setLojaAtivaId(firstId);
      localStorage.setItem("loja_ativa_id", firstId);
    }
  }, [lojas, isLoading, lojaAtivaId]);

  const handleSetLojaAtivaId = (id: string) => {
    setLojaAtivaId(id);
    localStorage.setItem("loja_ativa_id", id);
  };

  const lojaAtiva = lojas.find((l) => l.id === lojaAtivaId) || null;

  return (
    <LojaContext.Provider value={{ lojaAtiva, lojas, setLojaAtivaId: handleSetLojaAtivaId, loading: isLoading }}>
      {children}
    </LojaContext.Provider>
  );
}

export const useLojaAtiva = () => useContext(LojaContext);
