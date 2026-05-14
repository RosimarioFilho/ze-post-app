// ── Danger Zones — UI Overlays das Plataformas ───────────────────────
// Mapeia as áreas cobertas pela interface de cada rede social.
// Estas zonas devem ficar COMPLETAMENTE LIVRES de texto, CTA e logo.
// As instruções (promptWarning) são injetadas diretamente no prompt multimodal.

export interface DangerZone {
  id: string
  description: string    // descrição técnica (para debug / logs)
  promptWarning: string  // instrução direta para o modelo de geração
}

export const DANGER_ZONES: Record<string, DangerZone> = {
  // ── Instagram Stories ──────────────────────────────────────────
  instagram_stories_top: {
    id: 'instagram_stories_top',
    description: 'Instagram Stories — topo ~155px: avatar, username, timestamp, botão fechar',
    promptWarning:
      'top 15% is covered by Instagram Stories UI (profile picture, username, timestamp and close button) — keep this area completely clear of all text and graphics',
  },
  instagram_stories_bottom: {
    id: 'instagram_stories_bottom',
    description: 'Instagram Stories — rodapé ~155px: barra de resposta, botões de ação',
    promptWarning:
      'bottom 15% is covered by Instagram Stories reply bar and action buttons — place NO text, CTA or logo here',
  },
  instagram_stories_right: {
    id: 'instagram_stories_right',
    description: 'Instagram Stories — borda direita ~120px: botões share, heart, comment',
    promptWarning:
      'right 10% strip has Instagram action buttons (heart, comment, share) — keep this column entirely clear',
  },

  // ── Instagram Reels ────────────────────────────────────────────
  instagram_reels_bottom: {
    id: 'instagram_reels_bottom',
    description: 'Instagram Reels — rodapé ~320px: username, legenda, info de áudio, botões de ação',
    promptWarning:
      'bottom 22% is covered by Reels UI overlay (username, caption, audio info and action buttons) — do not place any element in this zone',
  },
  instagram_reels_right: {
    id: 'instagram_reels_right',
    description: 'Instagram Reels — borda direita ~120px: botões like, comment, share, áudio',
    promptWarning:
      'right 12% has Reels action buttons (like, comment, share, audio) — leave this column completely empty',
  },

  // ── Facebook Stories ───────────────────────────────────────────
  facebook_stories_top: {
    id: 'facebook_stories_top',
    description: 'Facebook Stories — topo ~250px: barra de status, timestamp, botão fechar',
    promptWarning:
      'top 14% is covered by Facebook Stories interface (status bar, timestamp, close button) — do not place content here',
  },
  facebook_stories_bottom: {
    id: 'facebook_stories_bottom',
    description: 'Facebook Stories — rodapé ~340px: barra de resposta, elementos interativos',
    promptWarning:
      'bottom 20% is covered by Facebook Stories reply bar and interactive elements — keep CTA and all text well above this area',
  },

  // ── TikTok ─────────────────────────────────────────────────────
  tiktok_right_bar: {
    id: 'tiktok_right_bar',
    description: 'TikTok — borda direita ~120px: botões like, comment, share, follow',
    promptWarning:
      'right 12% has TikTok action bar (likes, comments, share, follow buttons) — leave this entire column empty',
  },
  tiktok_bottom: {
    id: 'tiktok_bottom',
    description: 'TikTok — rodapé ~20%: username, legenda, metadados de áudio',
    promptWarning:
      'bottom 22% is covered by TikTok text overlay (username, video caption, audio metadata) — do not place any text or CTA here',
  },

  // ── WhatsApp ────────────────────────────────────────────────────
  whatsapp_top: {
    id: 'whatsapp_top',
    description: 'WhatsApp Status — topo ~250px: info do status, timestamp, ícones mute/report',
    promptWarning:
      'top 14% is covered by WhatsApp status bar (sender info, timestamp, mute/report icons) — keep this area clear',
  },
  whatsapp_bottom: {
    id: 'whatsapp_bottom',
    description: 'WhatsApp Status — rodapé ~400px: barra de resposta, botões de reação',
    promptWarning:
      'bottom 24% has WhatsApp reply input bar and reaction buttons — keep CTA and phone number well above this zone',
  },
}
