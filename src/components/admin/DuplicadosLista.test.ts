import { describe, it, expect } from "vitest";
import {
  resumoUnificacaoLabel,
  agruparDuplicados,
  type DuplicadoCadastro,
} from "./DuplicadosLista";

const base: DuplicadoCadastro = {
  id: "1",
  nome: "Distribuidora Alfa",
  representante: "joão silva",
  telefone: "5544999447117",
  email: null,
  created_at: "2026-01-01T00:00:00Z",
  user_id: "u1",
  cliente_nome: "Mercado Central",
  cliente_empresa: "Mercado Central",
  cidade: "Maringá",
  uf: "PR",
  origem_cadastro: "cliente",
  tipo_fornecedor: null,
  lojas_vinculadas: 2,
  total_relacionamentos: 5,
  grupo_key: "f:44999447117",
  grupo_tipo: "whatsapp",
  mestre_sugerido: false,
};

describe("resumoUnificacaoLabel", () => {
  it("usa singular e plural corretamente", () => {
    expect(resumoUnificacaoLabel({ unificados: 1, relacionamentos_movidos: 1 })).toBe(
      "1 cadastro unificado · 1 vínculo transferido",
    );
    expect(resumoUnificacaoLabel({ unificados: 3, relacionamentos_movidos: 5 })).toBe(
      "3 cadastros unificados · 5 vínculos transferidos",
    );
  });

  it("omite vínculos zerados", () => {
    expect(resumoUnificacaoLabel({ unificados: 2, relacionamentos_movidos: 0 })).toBe(
      "2 cadastros unificados",
    );
  });
});

describe("agruparDuplicados", () => {
  it("agrupa pelo grupo_key preservando a ordem", () => {
    const a: DuplicadoCadastro = { ...base, id: "1", mestre_sugerido: true };
    const b: DuplicadoCadastro = { ...base, id: "2", mestre_sugerido: false };
    const c: DuplicadoCadastro = { ...base, id: "3", grupo_key: "n:beta|joao", grupo_tipo: "nome" };
    const grupos = agruparDuplicados([a, c, b]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].cadastros.map((x) => x.id)).toEqual(["1", "2"]);
    expect(grupos[1].cadastros.map((x) => x.id)).toEqual(["3"]);
  });
});
