/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Compra360'
const LOGO_URL = 'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada/logo-completa.png'

interface NotificationProps {
  titulo?: string
  mensagem?: string
  ctaLabel?: string
  ctaUrl?: string
}

const NotificationEmail = ({ titulo, mensagem, ctaLabel, ctaUrl }: NotificationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{titulo || `Nova notificação do ${SITE_NAME}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" />
        </Section>
        <Heading style={h1}>{titulo || 'Nova notificação'}</Heading>
        <Text style={text}>{mensagem || 'Você tem uma nova atualização no Compra360.'}</Text>
        {ctaUrl && (
          <Section style={{ textAlign: 'center' }}>
            <Button style={button} href={ctaUrl}>{ctaLabel || 'Ver detalhes'}</Button>
          </Section>
        )}
        <Text style={footer}>Enviado via {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NotificationEmail,
  subject: (data: Record<string, any>) => data?.titulo || `Notificação do ${SITE_NAME}`,
  displayName: 'Notificação',
  previewData: {
    titulo: 'Sua cotação foi respondida',
    mensagem: 'Um fornecedor enviou os preços para a cotação #128. Confira agora os melhores valores.',
    ctaLabel: 'Ver cotação',
    ctaUrl: 'https://compra360app.com.br/dashboard',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(174, 78%, 26%)', margin: '0 0 16px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: 'hsl(221, 16%, 47%)', lineHeight: '1.6', margin: '0 0 24px', textAlign: 'center' as const }
const button = { backgroundColor: 'hsl(174, 78%, 26%)', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: 'hsl(221, 16%, 60%)', margin: '32px 0 0', textAlign: 'center' as const }
