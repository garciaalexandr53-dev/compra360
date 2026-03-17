import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const sendBrowserNotification = (fornecedorNome: string) => {
  if (Notification.permission === "granted") {
    new Notification("📬 Preços recebidos!", {
      body: `${fornecedorNome} enviou preços na cotação.`,
      icon: "/favicon.ico",
      tag: "price-update",
    });
  }
};

const PriceNotificationListener = () => {
  const queryClient = useQueryClient();
  const fornecedorCache = useRef<Record<string, string>>({});

  useEffect(() => {
    // Request permission on mount
    requestNotificationPermission();

    const channel = supabase
      .channel("global-price-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "precos" },
        async (payload) => {
          const fornecedorId = (payload.new as any)?.fornecedor_id;
          if (!fornecedorId) return;

          // Resolve supplier name (cached)
          let nome = fornecedorCache.current[fornecedorId];
          if (!nome) {
            const { data } = await supabase
              .from("fornecedores")
              .select("nome")
              .eq("id", fornecedorId)
              .single();
            nome = data?.nome || "Fornecedor";
            fornecedorCache.current[fornecedorId] = nome;
          }

          toast.info(`📬 ${nome} enviou preços!`, { duration: 5000 });
          sendBrowserNotification(nome);
          queryClient.invalidateQueries({ queryKey: ["precos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "precos" },
        async (payload) => {
          const fornecedorId = (payload.new as any)?.fornecedor_id;
          if (!fornecedorId) return;

          let nome = fornecedorCache.current[fornecedorId];
          if (!nome) {
            const { data } = await supabase
              .from("fornecedores")
              .select("nome")
              .eq("id", fornecedorId)
              .single();
            nome = data?.nome || "Fornecedor";
            fornecedorCache.current[fornecedorId] = nome;
          }

          toast.info(`📬 ${nome} atualizou preços!`, { duration: 5000 });
          sendBrowserNotification(nome);
          queryClient.invalidateQueries({ queryKey: ["precos"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
};

export default PriceNotificationListener;
