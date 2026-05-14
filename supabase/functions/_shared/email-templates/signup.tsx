/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL =
  'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada/logo-completa.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email para começar a usar o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={LOGO_URL} alt={siteName} width="180" style={logo} />
        </Section>
        <Heading style={h1}>Bem-vindo ao {siteName}!</Heading>
        <Text style={text}>
          Obrigado por criar sua conta no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Para começar a economizar nas cotações do seu supermercado, confirme
          seu email{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            ({recipient})
          </Link>{' '}
          clicando no botão abaixo:
        </Text>
        <Section style={{ textAlign: 'center' as const }}>
          <Button style={button} href={confirmationUrl}>
            Confirmar email
          </Button>
        </Section>
        <Text style={footer}>
          Se você não criou esta conta, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
}
const link = { color: 'hsl(174, 78%, 26%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(174, 78%, 26%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(221, 16%, 60%)',
  margin: '32px 0 0',
  textAlign: 'center' as const,
}
