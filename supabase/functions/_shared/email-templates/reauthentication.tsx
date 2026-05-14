/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const LOGO_URL =
  'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada/logo-completa.png'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação Compra360</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt="Compra360" width="180" style={logo} />
        </Section>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>
          Use o código abaixo para confirmar quem você é:
        </Text>
        <Section style={{ textAlign: 'center' as const }}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          Este código expira em alguns minutos. Se você não solicitou, pode
          ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const logo = { display: 'inline-block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(174, 78%, 26%)',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const text = {
  fontSize: '15px',
  color: 'hsl(221, 16%, 47%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const codeStyle = {
  fontFamily: '"JetBrains Mono", Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: 'hsl(174, 78%, 26%)',
  letterSpacing: '6px',
  margin: '0 0 30px',
  display: 'inline-block',
  padding: '16px 24px',
  backgroundColor: 'hsl(174, 84%, 95%)',
  borderRadius: '8px',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(221, 16%, 60%)',
  margin: '32px 0 0',
  textAlign: 'center' as const,
}
