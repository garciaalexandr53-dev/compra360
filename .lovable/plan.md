## Como o sistema identifica as colunas da planilha ERP

Boa notícia: **você não precisa formatar a planilha de forma específica**. O sistema faz detecção automática dos cabeçalhos (primeira linha) procurando por nomes comuns em português e inglês, sem diferenciar maiúsculas/minúsculas.

### Colunas reconhecidas automaticamente

| Campo | Cabeçalhos aceitos (case-insensitive) | Obrigatório? |
|---|---|---|
| **Nome do produto** | `produto`, `nome`, `descrição`, `descricao`, `item`, `material`, `name`, `product` | Recomendado. Se nenhum for encontrado, usa a **primeira coluna** como fallback |
| **Quantidade** | `quantidade`, `qtd`, `qtde`, `qty`, `quant`, `quantity` | Opcional — padrão `1` se ausente |
| **Embalagem/Unidade** | `embalagem`, `unidade`, `un`, `unit`, `emb`, `und`, `uom` | Opcional — padrão `"un"` |
| **EAN / Código de barras** | `ean`, `ean13`, `gtin`, `codigo de barras`, `código de barras`, `cod barras`, `codbarras`, `barcode`, `codigo`, `código` | Opcional, mas **muito recomendado** |

### Por que o EAN importa tanto

O EAN é o que "casa" seu item com o **Catálogo Mestre** (11 mil+ produtos). Quando o EAN bate:
- O item entra na cotação com nome, embalagem e fator vindos do catálogo global — sem criar produto local
- Aparece com badge "Catálogo" na cotação

Sem EAN, o sistema tenta casar por **nome exato** com produtos locais já cadastrados; se não achar, cria um novo produto local.

### Formatos e regras técnicas

- **Extensões aceitas:** `.xlsx`, `.xls`, `.csv`
- **Quantidade** aceita vírgula ou ponto (`1,5` ou `1.5`)
- **EAN** é preservado como texto — zeros à esquerda não somem, caracteres não-numéricos são removidos
- Linhas sem nome de produto são ignoradas

### Formato ideal (para máxima taxa de acerto)

```text
produto              | quantidade | embalagem | ean
Arroz Tio João 5kg   | 10         | FD        | 7891234567890
Feijão Camil 1kg     | 20         | PCT       | 7899876543210
```

### Recomendação

Se sua planilha do ERP usa nomes muito diferentes (ex.: "descrição do material", "cód. barra"), você tem duas opções:
1. Renomear os cabeçalhos antes de importar (mais rápido)
2. Me pedir para adicionar novos aliases à detecção — é só me passar os nomes exatos que aparecem na sua planilha

Quer que eu amplie a lista de aliases para cobrir os cabeçalhos do seu ERP? Se sim, me envia os nomes das colunas que ele exporta.