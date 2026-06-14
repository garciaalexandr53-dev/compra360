
-- Enums
CREATE TYPE public.envio_status AS ENUM ('pendente','enviado','entregue','falhou');
CREATE TYPE public.envio_origem AS ENUM ('manual','automatica');
CREATE TYPE public.envio_acao AS ENUM ('envio_inicial','reenvio','atualizacao_status');

-- Add columns to cotacao_fornecedores
ALTER TABLE public.cotacao_fornecedores
  ADD COLUMN status_envio public.envio_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN enviado_em timestamptz,
  ADD COLUMN ultima_atualizacao_status timestamptz;

-- Historico table
CREATE TABLE public.historico_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  acao public.envio_acao NOT NULL,
  status public.envio_status NOT NULL,
  origem public.envio_origem NOT NULL DEFAULT 'manual',
  executado_por uuid REFERENCES auth.users(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX historico_envios_lookup_idx
  ON public.historico_envios (cotacao_id, fornecedor_id, created_at DESC);

GRANT SELECT, INSERT ON public.historico_envios TO authenticated;
GRANT ALL ON public.historico_envios TO service_role;

ALTER TABLE public.historico_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees historico_envios"
  ON public.historico_envios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cotacoes c WHERE c.id = cotacao_id AND c.created_by = auth.uid()));

CREATE POLICY "Owner inserts historico_envios"
  ON public.historico_envios FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cotacoes c WHERE c.id = cotacao_id AND c.created_by = auth.uid()));

-- RPC: atomic update + history insert
CREATE OR REPLACE FUNCTION public.registrar_envio_fornecedor(
  _cotacao_id uuid,
  _fornecedor_id uuid,
  _acao public.envio_acao,
  _status public.envio_status,
  _origem public.envio_origem DEFAULT 'manual',
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _hist_id uuid;
  _now timestamptz := now();
BEGIN
  SELECT created_by INTO _owner FROM public.cotacoes WHERE id = _cotacao_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF _origem = 'manual' THEN
    IF auth.uid() IS NULL OR auth.uid() <> _owner THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  -- Ensure relationship exists
  INSERT INTO public.cotacao_fornecedores (cotacao_id, fornecedor_id)
  VALUES (_cotacao_id, _fornecedor_id)
  ON CONFLICT (cotacao_id, fornecedor_id) DO NOTHING;

  UPDATE public.cotacao_fornecedores
  SET status_envio = _status,
      enviado_em = CASE
        WHEN _status = 'enviado' AND _acao = 'envio_inicial' AND enviado_em IS NULL THEN _now
        WHEN _status = 'enviado' AND _acao = 'reenvio' THEN _now
        ELSE enviado_em
      END,
      ultima_atualizacao_status = _now
  WHERE cotacao_id = _cotacao_id AND fornecedor_id = _fornecedor_id;

  INSERT INTO public.historico_envios
    (cotacao_id, fornecedor_id, acao, status, origem, executado_por, metadata)
  VALUES
    (_cotacao_id, _fornecedor_id, _acao, _status, _origem,
     CASE WHEN _origem = 'manual' THEN auth.uid() ELSE NULL END,
     _metadata)
  RETURNING id INTO _hist_id;

  RETURN _hist_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_envio_fornecedor(uuid, uuid, public.envio_acao, public.envio_status, public.envio_origem, jsonb) TO authenticated, service_role;
