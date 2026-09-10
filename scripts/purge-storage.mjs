#!/usr/bin/env node
/**
 * purge-storage.mjs — supprime les fichiers Storage orphelins
 * (non référencés par aucune ligne de la base).
 *
 * Il RE-CALCULE les orphelins lui-même (liste le storage + lit la
 * base), il ne fait pas confiance à une liste figée.
 *
 * Usage :
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/purge-storage.mjs              # dry-run (n'efface rien)
 *   node scripts/purge-storage.mjs --delete     # efface pour de bon
 *
 * La service_role key se trouve dans Dashboard → Project Settings → API.
 * NE PAS la commiter.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DO_DELETE = process.argv.includes('--delete');

if (!URL || !KEY) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans l\'environnement.');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Buckets à auditer. ong-backend2 inclus : on n'efface que les
// fichiers réellement non référencés, ceux qui le sont sont gardés.
const BUCKETS = ['ong-backend', 'ong-backend2', 'cv-uploads', 'thumbnails'];

// Ne jamais toucher un fichier plus récent que ça (travail en cours).
const MIN_AGE_DAYS = 30;

// Colonnes qui contiennent une URL / un chemin de fichier.
const URL_SOURCES = [
  ['news', ['image', 'image2', 'content']],
  ['videos', ['filepath', 'thumbnailpath', 'videourl']],
  ['team_members', ['image']],
  ['projects', ['image_url', 'document_url']],
  ['project_tasks', ['document_url']],
  ['reports', ['image', 'fileUrl']],
  ['actions', ['image']],
  ['documents', ['file_url']],
  ['user_profiles', ['avatar_url']],
  ['form_submissions', ['cv_url']],
  ['events', ['image_url', 'logo_url', 'organizer_logos', 'partner_logos',
              'program', 'form_fields', 'poster_template', 'ticket_template',
              'certificate_template']],
];

async function buildHaystack() {
  let haystack = '';
  for (const [table, cols] of URL_SOURCES) {
    const { data, error } = await supabase.from(table).select(cols.join(','));
    if (error) {
      console.warn(`  ! ${table}: ${error.message} (ignoré)`);
      continue;
    }
    for (const row of data) {
      for (const c of cols) {
        const v = row[c];
        if (v == null) continue;
        haystack += ' ' + (typeof v === 'string' ? v : JSON.stringify(v));
      }
    }
  }
  return haystack;
}

async function listAll(bucket, prefix = '') {
  const out = [];
  let page = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100, offset: page * 100, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) { console.warn(`  ! list ${bucket}/${prefix}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id == null) {
        out.push(...await listAll(bucket, path));   // dossier -> récursion
      } else {
        out.push({ path, size: item.metadata?.size ?? 0, created: item.created_at });
      }
    }
    if (data.length < 100) break;
    page++;
  }
  return out;
}

const human = (b) => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} kB`;

(async () => {
  console.log('Lecture des références en base…');
  const haystack = await buildHaystack();

  const cutoff = Date.now() - MIN_AGE_DAYS * 864e5;
  let totalBytes = 0, totalFiles = 0;

  for (const bucket of BUCKETS) {
    const files = await listAll(bucket);
    const orphans = files.filter(f =>
      !haystack.includes(f.path) &&
      !f.path.endsWith('.emptyFolderPlaceholder') &&
      new Date(f.created).getTime() < cutoff
    );
    if (orphans.length === 0) { console.log(`\n${bucket}: rien à purger.`); continue; }

    const bytes = orphans.reduce((s, f) => s + Number(f.size), 0);
    totalBytes += bytes; totalFiles += orphans.length;
    console.log(`\n${bucket}: ${orphans.length} orphelins (${human(bytes)})`);
    for (const f of orphans) console.log(`  - ${f.path}  [${human(Number(f.size))}]`);

    if (DO_DELETE) {
      for (let i = 0; i < orphans.length; i += 100) {
        const batch = orphans.slice(i, i + 100).map(f => f.path);
        const { error } = await supabase.storage.from(bucket).remove(batch);
        console.log(error ? `  ✗ ${error.message}` : `  ✓ ${batch.length} supprimés`);
      }
    }
  }

  console.log(`\n${DO_DELETE ? 'SUPPRIMÉ' : 'À supprimer (dry-run)'} : ${totalFiles} fichiers, ${human(totalBytes)}`);
  if (!DO_DELETE) console.log('Relance avec --delete pour exécuter.');
})();
