import { useCallback, useRef, useState, type Ref } from "react";
import { Search, ScanBarcode, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import BarcodeScannerModal from "@/components/shared/BarcodeScannerModal";

export interface SearchInputComScannerProps {
  value: string;
  /** `meta.fromScanner` indica leitura por câmera (permite pular debounce). */
  onChange: (value: string, meta?: { fromScanner: boolean }) => void;
  placeholder?: string;
  /** Texto de ajuda discreto, exibido só quando o campo está vazio. */
  textoAjuda?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}

/** Campo de busca com ícone de scanner de código de barras à direita. */
const SearchInputComScanner = ({
  value,
  onChange,
  placeholder = "Buscar por nome ou código de barras",
  textoAjuda,
  className,
  inputRef,
  autoFocus,
}: SearchInputComScannerProps) => {
  const [scannerOpen, setScannerOpen] = useState(false);

  // Identidade estável: o scanner não deve reiniciar a câmera quando o pai re-renderiza.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleClose = useCallback(() => setScannerOpen(false), []);
  const handleDetected = useCallback(
    (code: string) => onChangeRef.current(code, { fromScanner: true }),
    [],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          /* Ao focar, seleciona tudo: digitar substitui o termo anterior sem apagar letra por letra. */
          onFocus={(e) => e.target.select()}
          className="pl-9 pr-20 h-12 text-base rounded-xl border-2 focus-visible:ring-primary"
          autoFocus={autoFocus}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value.length > 0 && (
            <button
              onClick={() => onChange("")}
              aria-label="Limpar busca"
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear código de barras"
            title="Escanear código de barras"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <ScanBarcode className="h-5 w-5" />
          </button>
        </div>
      </div>

      {textoAjuda && value.length === 0 && (
        <p className="px-1 text-xs leading-snug text-muted-foreground">{textoAjuda}</p>
      )}

      <BarcodeScannerModal open={scannerOpen} onClose={handleClose} onDetected={handleDetected} />
    </div>
  );
};

export default SearchInputComScanner;
