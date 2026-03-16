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
      categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
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
          id: string
          produto_id: string
          quantidade: number | null
        }
        Insert: {
          cotacao_id: string
          id?: string
          produto_id: string
          quantidade?: number | null
        }
        Update: {
          cotacao_id?: string
          id?: string
          produto_id?: string
          quantidade?: number | null
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
        }
        Relationships: []
      }
      itens_faltantes: {
        Row: {
          created_at: string
          id: string
          importado: boolean
          nome: string
          observacao: string | null
          quantidade: number | null
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          importado?: boolean
          nome: string
          observacao?: string | null
          quantidade?: number | null
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          importado?: boolean
          nome?: string
          observacao?: string | null
          quantidade?: number | null
          registrado_por?: string | null
        }
        Relationships: []
      }
      lojas: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
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
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          embalagem?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          embalagem?: string | null
          id?: string
          nome?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_supplier_id_from_token: { Args: { _token: string }; Returns: string }
      is_buyer: { Args: never; Returns: boolean }
    }
    Enums: {
      cotacao_status: "ativa" | "finalizada" | "cancelada"
      pedido_status: "rascunho" | "enviado" | "confirmado" | "recebido"
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
    },
  },
} as const
