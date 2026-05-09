'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src="/logo-ze-post.svg" alt="Zé Post" className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-2xl font-black text-slate-900 mb-1">Criar sua conta</h2>
          <p className="text-slate-500 text-sm mb-7">Comece grátis com o plano Starter</p>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Input id="name" label="Seu nome" placeholder="João Silva" value={form.name} onChange={set('name')} required />
            <Input id="email" type="email" label="E-mail" placeholder="seu@email.com" value={form.email} onChange={set('email')} required />
            <Input id="password" type="password" label="Senha" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} required minLength={6} />
            <Input id="confirm" type="password" label="Confirmar senha" placeholder="Repita a senha" value={form.confirm} onChange={set('confirm')} required />

            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
              Criar conta
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Já tem conta?{' '}
            <Link href="/login" className="text-ze-blue font-semibold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
