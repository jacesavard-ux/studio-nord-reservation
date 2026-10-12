// Petite couche SQLite (sql.js, WASM — aucune compilation native) avec une API style better-sqlite3.
const fs = require('fs');
const initSqlJs = require('sql.js');
module.exports = async function open(file) {
  const SQL = await initSqlJs();
  const raw = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  let depth = 0;
  const save = () => { if (depth === 0) fs.writeFileSync(file + '.tmp', Buffer.from(raw.export())), fs.renameSync(file + '.tmp', file); };
  const bind = a => (a.length === 1 && a[0] && typeof a[0] === 'object') ? Object.fromEntries(Object.entries(a[0]).map(([k, v]) => ['@' + k, v ?? null])) : a.map(v => v ?? null);
  const db = {
    exec: s => { raw.exec(s); save(); },
    pragma: () => {},
    prepare: sql => ({
      all: (...a) => { const st = raw.prepare(sql); st.bind(bind(a)); const r = []; while (st.step()) r.push(st.getAsObject()); st.free(); return r; },
      get: (...a) => db.prepare(sql).all(...a)[0],
      run: (...a) => { raw.run(sql, bind(a)); save(); },
    }),
    transaction: fn => (...a) => { raw.exec('BEGIN'); depth++; try { const r = fn(...a); depth--; raw.exec('COMMIT'); save(); return r; } catch (e) { depth--; raw.exec('ROLLBACK'); throw e; } },
  };
  return db;
};
