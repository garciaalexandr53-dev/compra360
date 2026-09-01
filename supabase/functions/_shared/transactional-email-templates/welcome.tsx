/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { BulletproofButton } from '../BulletproofButton.tsx'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Compra360'
const SITE_URL = 'https://compra360app.com.br'
const LOGO_URL = 'https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada/logo-completa.png'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="180" />
        </Section>
        <Heading style={h1}>{name ? `Olá, ${name}!` : 'Olá!'}</Heading>
        <Text style={text}>
          Seja bem-vindo(a) ao <strong>{SITE_NAME}</strong>. Estamos felizes em ter você conosco.
          A partir de agora você poderá criar cotações, comparar fornecedores e economizar
          em todos os pedidos do seu supermercado.
        </Text>
        <Section style={{ textAlign: 'center' }}>
          <BulletproofButton href={`${SITE_URL}/dashboard`} label="Acessar o painel">Acessar o painel</BulletproofButton>
        </Section>
        <Text style={footer}>
          Precisa de ajuda? Responda este e-mail que nossa equipe vai te atender.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Bem-vindo ao Compra360!',
  displayName: 'Boas-vindas',
  previewData: { name: 'João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(174, 78%, 26%)', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: 'hsl(221, 16%, 47%)', lineHeight: '1.6', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: 'hsl(221, 16%, 60%)', margin: '32px 0 0', textAlign: 'center' as const }
