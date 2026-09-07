export const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

export const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'conference', label: 'Conférence' },
  { value: 'atelier', label: 'Atelier' },
  { value: 'formation', label: 'Formation' },
  { value: 'webinaire', label: 'Webinaire' },
  { value: 'collecte_fonds', label: 'Collecte de fonds' },
  { value: 'benevolat', label: 'Bénévolat' },
  { value: 'autre', label: 'Autre' },
];
