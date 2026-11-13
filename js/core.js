(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PSGJCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalize(text, chars = {}) {
    return Array.from(String(text ?? '').normalize('NFKC').toLowerCase().trim())
      .map(c => chars[c] || c).join('');
  }

  function searchPeople(people, filters = {}, chars = {}) {
    const query = normalize(filters.query, chars);
    const terms = query.split(/\s+/).filter(Boolean);
    const [first, last] = (filters.period || '').split('-').map(Number);
    const mode = filters.mode || 'name';
    const matches = [];
    for (const p of people) {
      if (first && (!p.birth || p.birth < first || p.birth > last)) continue;
      if (filters.place) {
        const hasPlace = filters.placeMode === 'activity'
          ? p.postings.some(r => r.places.includes(filters.place))
          : p.addresses.some(a => a.key === filters.place && a.typeCode === 1);
        if (!hasPlace) continue;
      }
      if (filters.entryCode != null && !p.entries.some(e => e.code === Number(filters.entryCode))) continue;
      let text = '';
      if (mode === 'address') text = p.addresses.map(a => a.name).join(' ');
      else if (mode === 'entry') text = p.entries.map(e => e.name).join(' ');
      else if (mode === 'office') text = p.postings.map(e => e.office).join(' ');
      else text = `${p.name} ${p.searchName || ''} ${p.roman || ''} ${p.id}`;
      const normalText = normalize(text, chars);
      if (!terms.every(t => normalText.includes(t))) continue;
      const exact = normalize(p.name, chars) === query || String(p.id) === query || normalize(p.searchName, chars) === query;
      const quality = (p.birth ? 2 : 0) + (p.death ? 1 : 0) + Math.min(p.addresses.length, 4) + Math.min(p.entries.length, 3);
      matches.push({p, score: (exact ? 100 : 0) + quality});
    }
    if (query) matches.sort((a, b) => b.score - a.score || a.p.id - b.p.id);
    return matches.map(m => m.p);
  }

  function makeCSV(headers, rows) {
    const cell = value => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    return '\ufeff' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  }

  function escapeHTML(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  }

  return {normalize, searchPeople, makeCSV, escapeHTML};
});
