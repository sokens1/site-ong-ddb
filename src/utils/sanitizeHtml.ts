/**
 * Nettoie un fragment HTML avant rendu via dangerouslySetInnerHTML, pour se
 * protéger d'un XSS stocké (contenu édité via RichTextEditor par un compte
 * admin/chef de projet compromis ou malveillant, puis affiché à d'autres
 * utilisateurs authentifiés).
 *
 * Retire : <script>, <iframe>, <object>, <embed>, <base>, <meta>,
 * tous les attributs on* (onerror, onload, ...), les href/src en
 * "javascript:" (y compris avec espaces/tabulations d'évasion), et les
 * styles contenant "expression(" ou "javascript:".
 *
 * Ce n'est pas un remplacement complet d'une lib dédiée (DOMPurify) mais
 * couvre les vecteurs XSS courants pour du contenu HTML "riche" simple.
 */
export const sanitizeHTML = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    doc.querySelectorAll('script, iframe, object, embed, base, meta, link').forEach(el => el.remove());

    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        // Retire les espaces/caractères de contrôle pour détecter les évasions type "java\tscript:"
        const value = attr.value.replace(/[\x00-\x20]+/g, '').toLowerCase();

        if (name.startsWith('on') || name === 'formaction' || name === 'srcdoc') {
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src' || name === 'action') && value.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === 'style' && (value.includes('javascript:') || value.includes('expression('))) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  } catch {
    return '';
  }
};
