export type ImportReport = {
  content: string;
  notices: string[];
};

export function importHomebrewerySource(source: string): ImportReport {
  const notices: string[] = [];
  let content = source.replace(/\r\n/g, '\n');

  if (/<script\b/i.test(content)) {
    content = content.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    notices.push('Removed script tags for safety.');
  }
  if (/^\s*\\page\s*$/m.test(content)) {
    content = content.replace(/^\s*\\page\s*$/gm, ':::pagebreak');
    notices.push('Converted \\page commands to page breaks.');
  }
  if (/^\s*\\column\s*$/m.test(content)) notices.push('Column commands were retained as source; review them after import.');
  if (/\{\{\s*descriptive\b/i.test(content)) notices.push('Descriptive blocks were retained as source; they are not rendered as a special block.');
  if (/<style\b/i.test(content)) notices.push('Style tags were retained as source but are not executed or rendered.');

  return { content: content.trim(), notices };
}

export function titleFromImportedSource(content: string, fallback = 'Imported Brew') {
  const heading = content.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1];
  return heading?.replace(/[*_`]/g, '').trim() || fallback;
}
