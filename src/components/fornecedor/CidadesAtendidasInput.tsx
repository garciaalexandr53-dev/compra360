import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { X, MapPin } from "lucide-react";
import { buscarMunicipios, type Municipio } from "@/lib/cep";
import { adicionarCidade, removerCidade } from "@/lib/cidades";

interface Props {
  cidades: Municipio[];
  onChange: (cidades: Municipio[]) => void;
  placeholder?: string;
  /** Classes extras do campo (usado em telas de fundo escuro). */
  inputClassName?: string;
}

/** Campo de cidades atendidas com autocompletar da base oficial (IBGE). */
const CidadesAtendidasInput = ({ cidades, onChange, placeholder, inputClassName }: Props) => {
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<Municipio[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (termo.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const lista = await buscarMunicipios(termo);
      setSugestoes(lista);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [termo]);

  const adicionar = (m: Municipio) => {
    onChange(adicionarCidade(cidades, m));
    setTermo("");
    setSugestoes([]);
  };

  return (
    <div className="space-y-2">
      {cidades.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cidades.map((m) => (
            <span
              key={`${m.cidade}-${m.uf}`}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              <MapPin className="h-3 w-3" />
              {m.cidade}
              {m.uf ? ` - ${m.uf}` : ""}
              <button
                type="button"
                aria-label={`Remover ${m.cidade}`}
                onClick={() => onChange(removerCidade(cidades, m))}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={placeholder ?? "Digite a cidade (ex.: Jus...)"}
          autoComplete="off"
          className={`bg-background text-foreground placeholder:text-muted-foreground ${inputClassName ?? ""}`}
        />
        {sugestoes.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            {sugestoes.map((m) => (
              <button
                key={`${m.cidade}-${m.uf}`}
                type="button"
                onClick={() => adicionar(m)}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full text-left text-sm px-3 py-2.5 font-medium text-popover-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {m.cidade}
                {m.uf ? ` - ${m.uf}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CidadesAtendidasInput;
