import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ShoppingCart, MessageSquare } from "lucide-react";
import ResumoDistribuicaoContent from "@/components/analise/ResumoDistribuicaoContent";
import PedidosContent from "@/components/analise/PedidosContent";
import ChatContent from "@/components/analise/ChatContent";

const AnalisePage = () => {
  return (
    <div className="p-5">
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="resumo" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Pedidos
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Chat IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ResumoDistribuicaoContent />
        </TabsContent>

        <TabsContent value="pedidos">
          <PedidosContent />
        </TabsContent>

        <TabsContent value="chat">
          <ChatContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalisePage;
