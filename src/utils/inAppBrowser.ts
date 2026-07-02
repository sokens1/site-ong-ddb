/**
 * Détection des navigateurs intégrés (Facebook, Instagram, Messenger, etc.)
 * Ces WebViews bloquent silencieusement les téléchargements déclenchés en JS
 * (canvas.toDataURL + <a download>, jsPDF.save, ...) sans lever d'erreur.
 */
export const isInAppBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MessengerForiOS|Twitter|TikTok/i.test(ua);
};

export const isAndroidDevice = (): boolean =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

/**
 * Sur Android, ouvre le lien courant via un intent:// sans imposer de navigateur précis :
 * le système propose le choix entre les navigateurs installés (Chrome, Samsung Internet,
 * Firefox, ...) ou l'ouvre directement s'il y a un navigateur par défaut.
 * Sur iOS, il n'existe pas d'équivalent — Apple interdit aux WebViews de forcer
 * l'ouverture de Safari en JS, d'où les instructions manuelles dans la bannière.
 */
export const openInExternalBrowser = () => {
  const currentUrl = window.location.href;
  if (isAndroidDevice()) {
    const strippedUrl = currentUrl.replace(/^https?:\/\//, '');
    window.location.href = `intent://${strippedUrl}#Intent;scheme=https;end`;
  }
};
