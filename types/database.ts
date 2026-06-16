export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'owner' | 'manager' | 'staff'
export type SalaryType = 'hourly' | 'fixed'
export type PaymentMethod = 'cash' | 'credit_card' | 'qr_payment' | 'online' | 'bank_transfer' | 'other'
export type ExpenseCategory = 'alcohol' | 'fresh_ingredients' | 'garnish' | 'food' | 'equipment' | 'repair' | 'cleaning' | 'marketing' | 'salary' | 'claims' | 'rental' | 'utilities' | 'others'
export type StockMovementType = 'added' | 'used' | 'wasted' | 'adjusted'
export type FixedCostStatus = 'paid' | 'unpaid' | 'overdue'
export type ProfitDistributionStatus = 'retained' | 'paid_out'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          position: string
          phone: string | null
          email: string | null
          start_date: string
          end_date: string | null
          salary_type: SalaryType
          hourly_rate: number | null
          fixed_monthly_salary: number | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      attendance: {
        Row: {
          id: string
          employee_id: string
          date: string
          clock_in: string | null
          clock_out: string | null
          hours_worked: number | null
          is_public_holiday: boolean
          ph_multiplier: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      salary_records: {
        Row: {
          id: string
          employee_id: string
          month: number
          year: number
          total_hours: number | null
          normal_hours: number | null
          ph_hours: number | null
          base_salary: number
          ph_bonus: number
          deductions: number
          total_salary: number
          is_paid: boolean
          paid_at: string | null
          payment_method: PaymentMethod | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['salary_records']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['salary_records']['Insert']>
      }
      daily_sales: {
        Row: {
          id: string
          date: string
          cocktails_revenue: number
          beer_revenue: number
          wine_revenue: number
          food_revenue: number
          others_revenue: number
          total_revenue: number
          cash_collected: number
          credit_card_collected: number
          qr_collected: number
          online_collected: number
          total_collected: number
          is_balanced: boolean
          transaction_count: number
          notes: string | null
          attachment_url: string | null
          entered_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['daily_sales']['Row'], 'id' | 'total_revenue' | 'total_collected' | 'is_balanced' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['daily_sales']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          date: string
          expense_period: string | null
          supplier_id: string | null
          supplier_name: string | null
          category: ExpenseCategory
          description: string
          amount: number
          payment_method: PaymentMethod
          receipt_url: string | null
          notes: string | null
          entered_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      receipts: {
        Row: {
          id: string
          expense_id: string | null
          file_url: string
          file_type: string
          file_name: string
          file_size: number | null
          ocr_extracted: boolean
          ocr_supplier_name: string | null
          ocr_date: string | null
          ocr_amount: number | null
          ocr_raw_text: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['receipts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['receipts']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          address: string | null
          category: ExpenseCategory | null
          payment_terms: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      ingredients: {
        Row: {
          id: string
          name: string
          category: string
          supplier_id: string | null
          unit: string
          bottle_size_ml: number | null
          cost_per_bottle: number | null
          cost_per_unit: number | null
          current_stock: number
          min_stock_level: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['ingredients']['Row'], 'id' | 'cost_per_unit' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ingredients']['Insert']>
      }
      cocktails: {
        Row: {
          id: string
          name: string
          description: string | null
          selling_price: number
          garnish_cost: number
          ice_cost: number
          other_cost: number
          total_cost: number | null
          gross_profit: number | null
          profit_margin: number | null
          image_url: string | null
          is_active: boolean
          is_on_menu: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['cocktails']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cocktails']['Insert']>
      }
      cocktail_recipes: {
        Row: {
          id: string
          cocktail_id: string
          ingredient_id: string
          quantity_ml: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cocktail_recipes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cocktail_recipes']['Insert']>
      }
      inventory: {
        Row: {
          id: string
          ingredient_id: string
          movement_type: StockMovementType
          quantity: number
          unit_cost: number | null
          total_cost: number | null
          supplier_id: string | null
          reference_id: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      fixed_costs: {
        Row: {
          id: string
          name: string
          category: string
          amount: number
          due_day: number | null
          is_recurring: boolean
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['fixed_costs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['fixed_costs']['Insert']>
      }
      rental_records: {
        Row: {
          id: string
          fixed_cost_id: string
          month: number
          year: number
          amount: number
          status: FixedCostStatus
          due_date: string | null
          paid_date: string | null
          payment_method: PaymentMethod | null
          receipt_url: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rental_records']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rental_records']['Insert']>
      }
      partners: {
        Row: {
          id: string
          name: string
          ownership_percentage: number
          email: string | null
          phone: string | null
          join_date: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['partners']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['partners']['Insert']>
      }
      profit_distribution: {
        Row: {
          id: string
          partner_id: string
          month: number
          year: number
          total_revenue: number
          total_expenses: number
          net_profit: number
          ownership_percentage: number
          partner_share: number
          status: ProfitDistributionStatus
          paid_date: string | null
          payment_method: PaymentMethod | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profit_distribution']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profit_distribution']['Insert']>
      }
      reports: {
        Row: {
          id: string
          report_type: string
          title: string
          month: number | null
          year: number | null
          date_from: string | null
          date_to: string | null
          data: Json | null
          file_url: string | null
          generated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['reports']['Insert']>
      }
      monthly_targets: {
        Row: {
          id: string
          month: number
          year: number
          revenue_target: number
          expense_budget: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['monthly_targets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['monthly_targets']['Insert']>
      }
      sales_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales_categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sales_categories']['Insert']>
      }
    }
    Views: {}
    Functions: {
      calculate_cocktail_cost: {
        Args: { cocktail_uuid: string }
        Returns: { total_cost: number; gross_profit: number; profit_margin: number }[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: UserRole
      }
    }
    Enums: {
      user_role: UserRole
      salary_type: SalaryType
      payment_method: PaymentMethod
      expense_category: ExpenseCategory
      stock_movement_type: StockMovementType
      fixed_cost_status: FixedCostStatus
      profit_distribution_status: ProfitDistributionStatus
    }
  }
}
