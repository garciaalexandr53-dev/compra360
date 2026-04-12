export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      catalogo_base: {
        Row: {
          categoria: string
          created_at: string
          embalagem: string
          fator_embalagem: number
          id: string
          nome: string
          segmento: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          embalagem?: string
          fator_embalagem?: number
          id?: string
          nome: string
          segmento?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          embalagem?: string
          fator_embalagem?: number
          id?: string
          nome?: string
          segmento?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conferencia_itens: {
        Row: {
          conferencia_id: string
          divergencia_preco: boolean
          divergencia_qtd: boolean
          embalagem: string | null
          id: string
          preco_cotado: number | null
          preco_nf: number | null
          produto_nome: string
          quantidade_pedida: number
          quantidade_recebida: number
        }
        Insert: {
          conferencia_id: string
          divergencia_preco?: boolean
          divergencia_qtd?: boolean
          embalagem?: string | null
          id?: string
          preco_cotado?: number | null
          preco_nf?: number | null
          produto_nome: string
          quantidade_pedida?: number
          quantidade_recebida?: number
        }
        Update: {
          conferencia_id?: string
          divergencia_preco?: boolean
          divergencia_qtd?: boolean
          embalagem?: string | null
          id?: string
          preco_cotado?: number | null
          preco_nf?: number | null
          produto_nome?: string
          quantidade_pedida?: number
          quantidade_recebida?: number
        }
        Relationships: [
          {
            foreignKeyName: "conferencia_itens_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencias: {
        Row: {
          conferido_por: string
          created_at: string
          id: string
          observacoes: string | null
          pedido_id: string
        }
        Insert: {
          conferido_por?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pedido_id: string
        }
        Update: {
          conferido_por?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_fornecedores: {
        Row: {
          cotacao_id: string
          created_at: string
          fornecedor_id: string
          id: string
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          fornecedor_id: string
          id?: string
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          fornecedor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_fornecedores_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_produtos: {
        Row: {
          cotacao_id: string
          fator_embalagem: number
          id: string
          produto_id: string
          quantidade: number | null
          tipo_embalagem: string | null
        }
        Insert: {
          cotacao_id: string
          fator_embalagem?: number
          id?: string
          produto_id: string
          quantidade?: number | null
          tipo_embalagem?: string | null
        }
        Update: {
          cotacao_id?: string
          fator_embalagem?: number
          id?: string
          produto_id?: string
          quantidade?: number | null
          tipo_embalagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_produtos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          created_at: string
          created_by: string | null
          finalizada_at: string | null
          id: string
          loja_id: string | null
          nome: string
          status: Database["public"]["Enums"]["cotacao_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          finalizada_at?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          status?: Database["public"]["Enums"]["cotacao_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          finalizada_at?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["cotacao_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fornecedor_lojas: {
        Row: {
          created_at: string
          fornecedor_id: string
          id: string
          loja_id: string
        }
        Insert: {
          created_at?: string
          fornecedor_id: string
          id?: string
          loja_id: string
        }
        Update: {
          created_at?: string
          fornecedor_id?: string
          id?: string
          loja_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_lojas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedor_lojas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          pedido_minimo: number | null
          prazo_pagamento: string | null
          representante: string | null
          telefone: string | null
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          pedido_minimo?: number | null
          prazo_pagamento?: string | null
          representante?: string | null
          telefone?: string | null
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          pedido_minimo?: number | null
          prazo_pagamento?: string | null
          representante?: string | null
          telefone?: string | null
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      itens_faltantes: {
        Row: {
          created_at: string
          id: string
          importado: boolean
          loja_id: string | null
          nome: string
          observacao: string | null
          quantidade: number | null
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          importado?: boolean
          loja_id?: string | null
          nome: string
          observacao?: string | null
          quantidade?: number | null
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          importado?: boolean
          loja_id?: string | null
          nome?: string
          observacao?: string | null
          quantidade?: number | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_faltantes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          cnpj: string | null
          created_at: string
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          razao_social: string | null
          user_id: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          razao_social?: string | null
          user_id?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          razao_social?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          cotacao_id: string
          created_at: string
          created_by: string | null
          enviado_at: string | null
          fornecedor_id: string
          id: string
          loja_id: string | null
          numero: number
          status: Database["public"]["Enums"]["pedido_status"]
          total: number | null
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          created_by?: string | null
          enviado_at?: string | null
          fornecedor_id: string
          id?: string
          loja_id?: string | null
          numero?: number
          status?: Database["public"]["Enums"]["pedido_status"]
          total?: number | null
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          created_by?: string | null
          enviado_at?: string | null
          fornecedor_id?: string
          id?: string
          loja_id?: string | null
          numero?: number
          status?: Database["public"]["Enums"]["pedido_status"]
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          features: Json
          id: string
          max_cotacoes_simultaneas: number
          max_fornecedores: number
          max_lojas: number
          max_produtos: number
          name: string
          price_monthly: number
          stripe_price_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          features?: Json
          id?: string
          max_cotacoes_simultaneas?: number
          max_fornecedores?: number
          max_lojas?: number
          max_produtos?: number
          name: string
          price_monthly?: number
          stripe_price_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          features?: Json
          id?: string
          max_cotacoes_simultaneas?: number
          max_fornecedores?: number
          max_lojas?: number
          max_produtos?: number
          name?: string
          price_monthly?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      precos: {
        Row: {
          cotacao_produto_id: string
          fornecedor_id: string
          id: string
          preco: number | null
          updated_at: string
        }
        Insert: {
          cotacao_produto_id: string
          fornecedor_id: string
          id?: string
          preco?: number | null
          updated_at?: string
        }
        Update: {
          cotacao_produto_id?: string
          fornecedor_id?: string
          id?: string
          preco?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_cotacao_produto_id_fkey"
            columns: ["cotacao_produto_id"]
            isOneToOne: false
            referencedRelation: "cotacao_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          embalagem: string | null
          fator_embalagem: number
          id: string
          nome: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          embalagem?: string | null
          fator_embalagem?: number
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          embalagem?: string | null
          fator_embalagem?: number
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trial_controls: {
        Row: {
          cnpj: string | null
          created_at: string
          device_fingerprint: string | null
          id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trial_eligibility: {
        Args: { _cnpj?: string; _fingerprint?: string; _phone?: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_loja_owner: { Args: { _loja_id: string }; Returns: string }
      get_lojas_public: {
        Args: { _loja_id?: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      get_supplier_id_from_token: { Args: { _token: string }; Returns: string }
      get_supplier_info: {
        Args: { _token: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      get_user_plan: { Args: { _user_id?: string }; Returns: Json }
      is_buyer: { Args: never; Returns: boolean }
      loja_exists: { Args: { _loja_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pedido_is_enviado: { Args: { _pedido_id: string }; Returns: boolean }
      pedido_owner: { Args: { _pedido_id: string }; Returns: string }
      produto_belongs_to_loja_owner: {
        Args: { _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      cotacao_status: "ativa" | "finalizada" | "cancelada"
      pedido_status: "rascunho" | "enviado" | "confirmado" | "recebido"
      subscription_status: "active" | "past_due" | "canceled" | "trialing"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cotacao_status: ["ativa", "finalizada", "cancelada"],
      pedido_status: ["rascunho", "enviado", "confirmado", "recebido"],
      subscription_status: ["active", "past_due", "canceled", "trialing"],
    },
  },
} as const
