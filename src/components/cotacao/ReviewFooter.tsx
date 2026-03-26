import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReviewFooterProps {
  itemCount: number;
  supplierCount: number;
}

const ReviewFooter = ({ itemCount, supplierCount }: ReviewFooterProps) => {
  const navigate = useNavigate();

  return (
    <div className="border-t bg-card px-4 py-3 shadow-[0_-4px_20px_rgba(15,20,34,.12)]">
      <Button
        className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl transition-all"
        onClick={() => navigate("/analise")}
      >
        Próximo passo → Analisar cotação
        <ArrowRight className="h-5 w-5" />
      </Button>
      <div className="flex items-center justify-center gap-3 mt-2">
        <span className="text-[11px] text-muted-foreground">
          {itemCount} {itemCount === 1 ? "produto" : "produtos"} · {supplierCount} {supplierCount === 1 ? "fornecedor" : "fornecedores"}
        </span>
      </div>
    </div>
  );
};

export default ReviewFooter;
