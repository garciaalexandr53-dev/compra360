import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ShoppingCart } from "lucide-react";
import ResumoContent from "@/components/analise/ResumoContent";
import PedidosContent from "@/components/analise/PedidosContent";

const AnalisePage = () => {
  return (
    <div className="p-5">
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="resumo" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ResumoContent />
        </TabsContent>

        <TabsContent value="pedidos">
          <PedidosContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalisePage;
