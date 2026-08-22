# Destacar percentual de economia no card Insights

## O que fazer

Em `src/pages/HistoricoPage.tsx`, no card **Economia estimada** da aba Insights, deixar o percentual de economia mais visualmente destacado, sem alterar o texto informativo.

### Atualmente
- O valor (R$ 11,61) é exibido em fonte grande e verde.
- O percentual ("3,7% de economia") aparece junto com a legenda "vs. média dos preços recebidos" em uma única linha pequena (`text-[10px]`), perdendo destaque.

### Proposto
1. Separar visualmente o percentual da legenda de referência.
2. Aplicar ao percentual um peso/tamanho que seja claramente legível, mas menor que o valor em reais, mantendo a hierarquia:
   - Valor em destaque (verde, grande, negrito).
   - Percentual logo abaixo, em tamanho um pouco maior que a legenda atual e com peso seminegrito (`font-semibold`).
   - Legenda "vs. média dos preços recebidos" permanece abaixo, em tamanho/tom discreto.
3. Exemplo de hierarquia resultante:
   ```text
   R$ 11,61
   3,7% de economia
   vs. média dos preços recebidos
   ```
4. Quando `kpis.totalGeral` for 0, manter apenas a legenda sem percentual.

## O que NÃO mudar
- O cálculo do percentual (`economia ÷ total no período × 100`).
- Os demais KPIs (Total, Produtos únicos, Fornecedores).
- A largura/altura do card e o layout do grid (`grid-cols-2 md:grid-cols-4`).
- A cor verde do valor principal.

## Verificação

- Typecheck e build verdes.
- Verificar preview em mobile 360px e desktop para confirmar que o card não quebra nem aumenta de altura de forma desproporcional.
- Confirmar que a legenda permanece legível e o percentual fica mais destacado.
