export type Plan = 'starter' | 'pro'

export type SquadRole =
  | 'estrategista'
  | 'copywriter'
  | 'designer'
  | 'social_media'
  | 'pesquisador'
  | 'postador'
  | 'carrossel'
  | 'revisora'

export type ContentType =
  | 'post_instagram'
  | 'post_facebook'
  | 'post_linkedin_imagem'
  | 'post_linkedin_texto'
  | 'stories'
  | 'carrossel'
  | 'youtube'
  | 'reels'

export type ContentStatus =
  | 'rascunho'
  | 'pendente_aprovacao'
  | 'aprovado'
  | 'agendado'
  | 'publicado'
  | 'rejeitado'

export type ApprovalStatus = 'pendente' | 'aprovado' | 'rejeitado'

export interface Company {
  id: string
  name: string
  razao_social?: string
  phone?: string
  logo_url?: string
  niche?: string
  primary_color: string
  secondary_color: string
  plan: Plan
  created_at: string
  updated_at: string
}

export const NICHE_OPTIONS: { value: string; label: string }[] = [
  { value: 'padaria', label: 'Padaria / Confeitaria' },
  { value: 'restaurante', label: 'Restaurante / Lanchonete' },
  { value: 'provedor_internet', label: 'Provedor de Internet' },
  { value: 'concessionaria', label: 'Concessionária / Veículos' },
  { value: 'moda', label: 'Moda / Vestuário' },
  { value: 'beleza', label: 'Beleza / Estética' },
  { value: 'academia', label: 'Academia / Saúde' },
  { value: 'imobiliaria', label: 'Imobiliária' },
  { value: 'educacao', label: 'Educação / Cursos' },
  { value: 'petshop', label: 'Pet Shop / Veterinária' },
  { value: 'tecnologia', label: 'Tecnologia / Software' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'servicos', label: 'Serviços em geral' },
  { value: 'outro', label: 'Outro' },
]

export interface Profile {
  id: string
  company_id?: string
  full_name?: string
  email?: string
  role: 'owner' | 'admin' | 'member'
  avatar_url?: string
  onboarding_completed: boolean
  company?: Company
}

export interface SquadMember {
  id: string
  company_id: string
  name: string
  role: SquadRole
  icon?: string
  title?: string
  avatar_url?: string
  prompt?: string
  task_prompt?: string
  skill_names?: string[]
  execution?: 'inline' | 'subagent'
  flow_order?: number
  is_active: boolean
}

export interface Content {
  id: string
  company_id: string
  created_by?: string
  title: string
  body?: string
  content_type: ContentType
  platforms: string[]
  status: ContentStatus
  media_urls: string[]
  scheduled_at?: string
  published_at?: string
  created_at: string
  updated_at: string
  creator?: Profile
}

export interface Approval {
  id: string
  content_id: string
  company_id: string
  requested_by?: string
  reviewed_by?: string
  status: ApprovalStatus
  comment?: string
  created_at: string
  content?: Content
  requester?: Profile
}

export interface MeetingMessage {
  id: string
  company_id: string
  meeting_session: string
  sender_type: 'user' | 'agent'
  user_id?: string
  agent_role?: SquadRole
  agent_name?: string
  message: string
  created_at: string
}

export interface SocialAccount {
  id: string
  company_id: string
  platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'youtube'
  account_name?: string
  account_id?: string
  is_active: boolean
  created_at: string
}

export const SQUAD_ROLES: Record<SquadRole, { label: string; color: string; description: string }> = {
  estrategista: { label: 'Estrategista de Conteúdo', color: '#3b82f6', description: 'Define estratégias e ângulos de conteúdo' },
  copywriter: { label: 'Copywriter', color: '#8b5cf6', description: 'Cria textos persuasivos e cativantes' },
  designer: { label: 'Designer Visual', color: '#ec4899', description: 'Cria artes HTML/CSS para redes sociais' },
  social_media: { label: 'Social Media Manager', color: '#10b981', description: 'Gerencia e publica nas redes sociais' },
  pesquisador: { label: 'Pesquisadora de Mercado', color: '#f59e0b', description: 'Pesquisa tendências e oportunidades' },
  postador: { label: 'Postador Digital', color: '#06b6d4', description: 'Publica e agenda conteúdo aprovado' },
  carrossel: { label: 'Especialista em Carrossel', color: '#f97316', description: 'Cria carrosseis visuais para redes sociais' },
  revisora: { label: 'Revisora de Qualidade', color: '#22c55e', description: 'Revisa e aprova o conteúdo antes da publicação' },
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post_instagram: 'Post Instagram',
  post_facebook: 'Post Facebook',
  post_linkedin_imagem: 'LinkedIn (Imagem)',
  post_linkedin_texto: 'LinkedIn (Texto)',
  stories: 'Stories',
  carrossel: 'Carrossel',
  youtube: 'YouTube',
  reels: 'Reels',
}

export const STATUS_LABELS: Record<ContentStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  pendente_aprovacao: { label: 'Aguardando aprovação', color: 'bg-yellow-100 text-yellow-700' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  agendado: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  publicado: { label: 'Publicado', color: 'bg-emerald-100 text-emerald-700' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
}
