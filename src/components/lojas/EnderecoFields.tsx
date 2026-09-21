import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buscarCep, cepCompleto, buscarMunicipios, type Municipio } from "@/lib/cep";
import { formatCEP, formatUF } from "./lojaUtils";

export interface EnderecoValue {
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface Props {
  value: EnderecoValue;
  onChange: (next: EnderecoValue) => void;
  /** Exibe rua e bairro. Desligue em telas curtas (aviso rápido). */
  mostrarRuaBairro?: boolean;
  cidadeObrigatoria?: boolean;
  autoFocusCep?: boolean;
  compact?: boolean;
}

/**
 * Bloco padrão de endereço: CEP primeiro (preenche rua, bairro, cidade e UF),
 * com autocompletar de cidades do IBGE para quem não souber o CEP.
 */
export default function EnderecoFields({
  value,
  onChange,
  mostrarRuaBairro = true,
  cidadeObrigatoria = true,
  autoFocusCep = false,
  compact = false,
}: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const ultimoCep = useRef("");

  const [sugestoes, setSugestoes] = useState<Municipio[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const cidadeDigitada = useRef(false);

  const onCepChange = async (bruto: string) => {
    const cep = formatCEP(bruto);
    const next = { ...value, cep };
    onChange(next);
    if (!cepCompleto(cep) || ultimoCep.current === cep) return;
    ultimoCep.current = cep;
    setBuscandoCep(true);
    const r = await buscarCep(cep);
    setBuscandoCep(false);
    if (!r) {
      toast.error("CEP não encontrado. Preencha cidade e endereço manualmente.");
      return;
    }
    onChange({
      ...next,
      cidade: r.cidade,
      uf: r.uf,
      endereco: r.logradouro?.trim() ? r.logradouro : next.endereco,
      bairro: r.bairro?.trim() ? r.bairro : next.bairro,
    });
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  // Sugestões de cidade conforme digita
  useEffect(() => {
    if (!cidadeDigitada.current) return;
    const termo = value.cidade;
    if (termo.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    let ativo = true;
    const t = setTimeout(async () => {
      const r = await buscarMunicipios(termo);
      if (ativo) setSugestoes(r);
    }, 200);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [value.cidade]);

  const escolherCidade = (m: Municipio) => {
    cidadeDigitada.current = false;
    onChange({ ...value, cidade: m.cidade, uf: m.uf || value.uf });
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <Label>CEP</Label>
        <Input
          value={value.cep}
          onChange={(e) => onCepChange(e.target.value)}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
          autoFocus={autoFocusCep}
        />
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          {buscandoCep ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço…
            </>
          ) : (
            "Informe o CEP e o endereço é preenchido automaticamente."
          )}
        </p>
      </div>

      {mostrarRuaBairro && (
        <>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <div>
              <Label>Endereço</Label>
              <Input
                value={value.endereco}
                onChange={(e) => onChange({ ...value, endereco: e.target.value })}
                placeholder="Ex: Rua Principal"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Nº</Label>
              <Input
                value={value.numero}
                onChange={(e) => onChange({ ...value, numero: e.target.value })}
                placeholder="150"
                maxLength={12}
              />
            </div>
          </div>
          <div>
            <Label>Bairro</Label>
            <Input
              value={value.bairro}
              onChange={(e) => onChange({ ...value, bairro: e.target.value })}
              placeholder="Ex: Centro"
              maxLength={100}
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="relative">
          <Label>Cidade{cidadeObrigatoria ? " *" : ""}</Label>
          <Input
            value={value.cidade}
            onChange={(e) => {
              cidadeDigitada.current = true;
              setMostrarSugestoes(true);
              onChange({ ...value, cidade: e.target.value });
            }}
            onFocus={() => setMostrarSugestoes(true)}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
            placeholder="Digite e escolha. Ex: Cianorte"
            maxLength={100}
            autoComplete="off"
          />
          {mostrarSugestoes && sugestoes.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {sugestoes.map((m) => (
                <li key={`${m.cidade}-${m.uf}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolherCidade(m)}
                  >
                    {m.cidade}
                    {m.uf ? ` - ${m.uf}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="w-20">
          <Label>UF</Label>
          <Input
            value={value.uf}
            onChange={(e) => onChange({ ...value, uf: formatUF(e.target.value) })}
            placeholder="PR"
            maxLength={2}
            className="uppercase"
          />
        </div>
      </div>
    </div>
  );
}
