# Roadmap

## Concluído
- [x] Frente A — Cidade obrigatória: cidade/UF no cadastro inicial da loja, aviso no painel para lojas sem cidade (com edição rápida), selo "Sem cidade" na lista de lojas.
- [x] Consentimento e coleta de dados no link do fornecedor: CNPJ (com "Responder depois", limite de 3 tentativas), linhas de produto quando o CNPJ já existe em outro cadastro, pergunta da Rede (Sim/Não/Preciso pensar) com janela de 90 e 180 dias, sugestões da região restritas a quem respondeu "sim", CNPJ e consentimento visíveis na ficha do painel.

## Em espera (não construir)
- [x] Endereço padronizado das lojas — CEP primeiro preenchendo rua, número, bairro, cidade e UF, com autocompletar de municípios (IBGE), aplicado em Lojas, cadastro inicial, aviso do painel e ficha do cliente no Admin. Número em campo separado (pronto para nota fiscal).
- [ ] Frente B — Dados fiscais completos para emissão de nota (razão social, endereço com número e bairro, inscrição municipal, e-mail de faturamento), exigidos no momento da assinatura paga.
  - Bloqueio: aguardando decisão do Alexandre sobre qual emissor de nota fiscal será usado.

## Concluído (continuação)
- [x] Consentimento da Rede no link do fornecedor (CNPJ, pastas, sim/não/preciso pensar, janelas de 90/180 dias).
- [x] Edições manuais no Admin: cidade/UF das lojas na ficha do cliente e consentimento da rede na ficha do fornecedor.
- [x] Etapa 1 — Cidades atendidas pelo fornecedor: no link da cotação, quem aceita a Rede informa as cidades que atende (cidade da loja já sugerida, autocompletar do IBGE, quantas quiser), pedido uma única vez com link "Atualizar minhas cidades"; sugestões da região passam a cruzar as cidades declaradas; Admin edita as cidades na ficha do fornecedor.

## Próximos passos
- [x] Fase 2A — Página pública /seja-parceiro: atração (100% gratuito, sem senha, depoimentos) + cadastro do fornecedor com validação estrutural do WhatsApp, pastas e cidades atendidas (IBGE), anti-duplicidade por telefone e chamada no rodapé da Landing e do Login.
- [ ] Fase 2B — Confirmação reversa do WhatsApp (código de 4 dígitos + webhook da API), edição posterior sem senha e filtro "Auto-cadastro" no /admin. Blueprint em mem://features/rede-autocadastro-parceiro.
