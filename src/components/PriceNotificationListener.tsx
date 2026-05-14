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

const sendBrowserNotification = (fornecedorNome: string, isUpdate: boolean) => {
  if (Notification.permission === "granted") {
    new Notification(isUpdate ? "📬 Preços atualizados!" : "📬 Preços recebidos!", {
      body: `${fornecedorNome} ${isUpdate ? "atualizou" : "enviou"} preços na cotação.`,
      icon: "/favicon-32.png",
      tag: `price-${isUpdate ? "update" : "insert"}`,
    });
  }
};

const PriceNotificationListener = () => {
  const queryClient = useQueryClient();
  const fornecedorCache = useRef<Record<string, string>>({});
  // Debounce: accumulate events per fornecedor, fire one notification after 3s of quiet
  const pendingInserts = useRef<Set<string>>(new Set());
  const pendingUpdates = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveName = async (fornecedorId: string): Promise<string> => {
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
    return nome;
  };

  const flushNotifications = async () => {
    const inserts = new Set(pendingInserts.current);
    const updates = new Set(pendingUpdates.current);
    pendingInserts.current.clear();
    pendingUpdates.current.clear();

    // Fornecedores that only inserted (new prices)
    for (const fId of inserts) {
      const nome = await resolveName(fId);
      toast.info(`📬 ${nome} enviou preços!`, { duration: 5000 });
      sendBrowserNotification(nome, false);
    }

    // Fornecedores that only updated (and didn't also insert)
    for (const fId of updates) {
      if (!inserts.has(fId)) {
        const nome = await resolveName(fId);
        toast.info(`📬 ${nome} atualizou preços!`, { duration: 5000 });
        sendBrowserNotification(nome, true);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["precos"] });
  };

  const scheduleFlush = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushNotifications, 3000);
  };

  useEffect(() => {
    requestNotificationPermission();

    const channel = supabase
      .channel("global-price-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "precos" },
        (payload) => {
          const fornecedorId = (payload.new as any)?.fornecedor_id;
          if (!fornecedorId) return;
          pendingInserts.current.add(fornecedorId);
          scheduleFlush();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "precos" },
        (payload) => {
          const fornecedorId = (payload.new as any)?.fornecedor_id;
          if (!fornecedorId) return;
          pendingUpdates.current.add(fornecedorId);
          scheduleFlush();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
};

export default PriceNotificationListener;
