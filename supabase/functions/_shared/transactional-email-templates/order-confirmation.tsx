/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Compra360'
const LOGO_URL = 'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada/logo-completa.png'

interface OrderItem {
  nome: string
  quantidade: number | string
  preco?: number | string
  subtotal?: number | string
}

interface OrderConfirmationProps {
  pedidoNumero?: string | number
  fornecedor?: string
  loja?: string
  data?: string
  total?: string
  itens?: OrderItem[]
}

const OrderConfirmationEmail = ({
  pedidoNumero,
  fornecedor,
  loja,
  data,
  total,
  itens = [],
}: OrderConfirmationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirmação do pedido {pedidoNumero ? `#${pedidoNumero}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" />
        </Section>
        <Heading style={h1}>Pedido confirmado{pedidoNumero ? ` #${pedidoNumero}` : ''}</Heading>
        <Text style={text}>
          Seu pedido foi registrado com sucesso no <strong>{SITE_NAME}</strong>.
        </Text>

        <Section style={card}>
          {fornecedor && <Text style={cardLine}><strong>Fornecedor:</strong> {fornecedor}</Text>}
          {loja && <Text style={cardLine}><strong>Loja:</strong> {loja}</Text>}
          {data && <Text style={cardLine}><strong>Data:</strong> {data}</Text>}
          {total && <Text style={cardLine}><strong>Total:</strong> {total}</Text>}
        </Section>

        {itens.length > 0 && (
          <>
            <Heading as="h2" style={h2}>Itens</Heading>
            {itens.map((item, i) => (
              <Section key={i} style={{ margin: '0 0 12px' }}>
                <Text style={itemNome}>{item.nome}</Text>
                <Text style={itemDetalhe}>
                  Qtd: {item.quantidade}
                  {item.preco ? ` · Unit.: ${item.preco}` : ''}
                  {item.subtotal ? ` · Subtotal: ${item.subtotal}` : ''}
                </Text>
                <Hr style={hr} />
              </Section>
            ))}
          </>
        )}

        <Text style={footer}>Enviado via {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Confirmação do pedido${data?.pedidoNumero ? ` #${data.pedidoNumero}` : ''} — Compra360`,
  displayName: 'Confirmação de pedido',
  previewData: {
    pedidoNumero: '197',
    fornecedor: 'DESTRO ATACADO',
    loja: 'BRAND VAREJÃO - ST',
    data: '13/05/2026',
    total: 'R$ 2.045,21',
    itens: [
      { nome: 'Fósforo Paraná 10x40', quantidade: 2, preco: 'R$ 1,97', subtotal: 'R$ 78,80' },
      { nome: 'Sabonete Líquido Lux 200ml', quantidade: 6, preco: 'R$ 6,38', subtotal: 'R$ 38,28' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(174, 78%, 26%)', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: 'hsl(221, 39%, 20%)', margin: '24px 0 12px' }
const text = { fontSize: '15px', color: 'hsl(221, 16%, 47%)', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: 'hsl(210, 40%, 96%)', borderRadius: '8px', padding: '16px 20px', margin: '0 0 8px' }
const cardLine = { fontSize: '14px', color: 'hsl(221, 39%, 20%)', margin: '4px 0' }
const itemNome = { fontSize: '14px', fontWeight: 600, color: 'hsl(221, 39%, 20%)', margin: '0 0 4px' }
const itemDetalhe = { fontSize: '13px', color: 'hsl(221, 16%, 47%)', margin: '0 0 4px' }
const hr = { borderColor: 'hsl(210, 20%, 90%)', margin: '8px 0' }
const footer = { fontSize: '12px', color: 'hsl(221, 16%, 60%)', margin: '32px 0 0', textAlign: 'center' as const }
