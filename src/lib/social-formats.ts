// ── Social Media Format Registry ─────────────────────────────────────
// Dimensões oficiais, safe areas e danger zones por plataforma (2024/2025)

export type SocialFormatId =
  | 'INSTAGRAM_POST'
  | 'INSTAGRAM_STORIES'
  | 'INSTAGRAM_REELS_COVER'
  | 'INSTAGRAM_CAROUSEL'
  | 'FACEBOOK_POST'
  | 'FACEBOOK_STORIES'
  | 'TIKTOK_COVER'
  | 'YOUTUBE_THUMBNAIL'
  | 'LINKEDIN_POST'
  | 'WHATSAPP_STATUS'

export interface SocialFormat {
  id: SocialFormatId
  label: string           // label para dropdown na UI
  platform: string        // nome da plataforma
  officialW: number       // largura oficial da plataforma (px)
  officialH: number       // altura oficial da plataforma (px)
  genW: number            // largura passada ao modelo (suportada pelo OpenAI)
  genH: number            // altura passada ao modelo (suportada pelo OpenAI)
  aspectRatio: string     // '1:1' | '9:16' | '16:9' | '1.91:1'
  safeArea: {             // padding mínimo seguro em % da dimensão total
    top: number
    bottom: number
    left: number
    right: number
  }
  dangerZoneIds: string[] // IDs das danger zones desta plataforma
}

// Dimensões de geração suportadas pelo OpenAI gpt-image-1:
//   Square:    1024 × 1024
//   Portrait:  1024 × 1792  (9:16)
//   Landscape: 1792 × 1024  (16:9 / 1.91:1)
//
// O modelo recebe safe area como % para funcionar com qualquer resolução.

export const SOCIAL_FORMATS: Record<SocialFormatId, SocialFormat> = {
  INSTAGRAM_POST: {
    id: 'INSTAGRAM_POST',
    label: 'Instagram Post',
    platform: 'Instagram',
    officialW: 1080, officialH: 1080,
    genW: 1024, genH: 1024,
    aspectRatio: '1:1',
    safeArea: { top: 8, bottom: 8, left: 8, right: 8 },
    dangerZoneIds: [],
  },

  INSTAGRAM_STORIES: {
    id: 'INSTAGRAM_STORIES',
    label: 'Instagram Stories',
    platform: 'Instagram',
    officialW: 1080, officialH: 1920,
    genW: 1024, genH: 1792,
    aspectRatio: '9:16',
    safeArea: { top: 16, bottom: 16, left: 6, right: 10 },
    dangerZoneIds: ['instagram_stories_top', 'instagram_stories_bottom', 'instagram_stories_right'],
  },

  INSTAGRAM_REELS_COVER: {
    id: 'INSTAGRAM_REELS_COVER',
    label: 'Instagram Reels Cover',
    platform: 'Instagram',
    officialW: 1080, officialH: 1920,
    genW: 1024, genH: 1792,
    aspectRatio: '9:16',
    safeArea: { top: 12, bottom: 22, left: 6, right: 12 },
    dangerZoneIds: ['instagram_reels_bottom', 'instagram_reels_right'],
  },

  INSTAGRAM_CAROUSEL: {
    id: 'INSTAGRAM_CAROUSEL',
    label: 'Instagram Carousel',
    platform: 'Instagram',
    officialW: 1080, officialH: 1080,
    genW: 1024, genH: 1024,
    aspectRatio: '1:1',
    safeArea: { top: 8, bottom: 8, left: 8, right: 8 },
    dangerZoneIds: [],
  },

  FACEBOOK_POST: {
    id: 'FACEBOOK_POST',
    label: 'Facebook Post',
    platform: 'Facebook',
    officialW: 1200, officialH: 630,
    genW: 1792, genH: 1024,
    aspectRatio: '1.91:1',
    safeArea: { top: 8, bottom: 8, left: 6, right: 6 },
    dangerZoneIds: [],
  },

  FACEBOOK_STORIES: {
    id: 'FACEBOOK_STORIES',
    label: 'Facebook Stories',
    platform: 'Facebook',
    officialW: 1080, officialH: 1920,
    genW: 1024, genH: 1792,
    aspectRatio: '9:16',
    safeArea: { top: 16, bottom: 22, left: 6, right: 6 },
    dangerZoneIds: ['facebook_stories_top', 'facebook_stories_bottom'],
  },

  TIKTOK_COVER: {
    id: 'TIKTOK_COVER',
    label: 'TikTok Cover',
    platform: 'TikTok',
    officialW: 1080, officialH: 1920,
    genW: 1024, genH: 1792,
    aspectRatio: '9:16',
    safeArea: { top: 14, bottom: 28, left: 10, right: 14 },
    dangerZoneIds: ['tiktok_right_bar', 'tiktok_bottom'],
  },

  YOUTUBE_THUMBNAIL: {
    id: 'YOUTUBE_THUMBNAIL',
    label: 'YouTube Thumbnail',
    platform: 'YouTube',
    officialW: 1280, officialH: 720,
    genW: 1792, genH: 1024,
    aspectRatio: '16:9',
    safeArea: { top: 8, bottom: 8, left: 6, right: 6 },
    dangerZoneIds: [],
  },

  LINKEDIN_POST: {
    id: 'LINKEDIN_POST',
    label: 'LinkedIn Post',
    platform: 'LinkedIn',
    officialW: 1200, officialH: 627,
    genW: 1792, genH: 1024,
    aspectRatio: '1.91:1',
    safeArea: { top: 8, bottom: 8, left: 6, right: 6 },
    dangerZoneIds: [],
  },

  WHATSAPP_STATUS: {
    id: 'WHATSAPP_STATUS',
    label: 'WhatsApp Status',
    platform: 'WhatsApp',
    officialW: 1080, officialH: 1920,
    genW: 1024, genH: 1792,
    aspectRatio: '9:16',
    safeArea: { top: 16, bottom: 26, left: 6, right: 6 },
    dangerZoneIds: ['whatsapp_top', 'whatsapp_bottom'],
  },
}
