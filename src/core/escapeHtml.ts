const ENTITIES: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'};

/** Text (or a number) safe inside HTML, in element content and in quoted attributes; nothing for null/undefined. */
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, ch => ENTITIES[ch]);
