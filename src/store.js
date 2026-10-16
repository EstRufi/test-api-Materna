'use strict';

const { SPEC, validate, schemaProps } = require('./validate');
const { buildSeed } = require('./seed');
const { todayInSP, normalizeTime } = require('./dates');

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Configuração de cada coleção:
 *  schema   -> nome do schema no Swagger
 *  label    -> nome usado nas mensagens de erro (ex.: "Doadora not found")
 *  fks      -> campo -> coleção referenciada (validado no POST/PUT)
 *  children -> [coleção filha, campo FK]: excluídas em cascata quando o pai é excluído
 *  omit     -> campos do schema que não são guardados no registro
 */
const CONFIG = {
  doadora: { schema: 'Doadora', label: 'Doadora', fks: {}, children: [['ciclo', 'tbl_doadora_id'], ['documentoDoadora', 'tbl_doadora_id']] },
  funcionario: { schema: 'Funcionario', label: 'Funcionario', fks: {}, children: [['campanha', 'tbl_funcionario_id']] },
  tipoColeta: { schema: 'TipoColeta', label: 'TipoColeta', fks: {}, children: [['instituicao', 'id_coleta']] },
  instituicao: { schema: 'Instituicao', label: 'Instituicao', fks: { id_coleta: 'tipoColeta' }, children: [['campanha', 'id_instituicao'], ['jornada', 'tbl_instituicao_id']] },
  campanha: { schema: 'Campanha', label: 'Campanha', fks: { id_instituicao: 'instituicao', tbl_funcionario_id: 'funcionario' }, children: [] },
  jornada: { schema: 'Jornada', label: 'Jornada', fks: { tbl_instituicao_id: 'instituicao' }, children: [['etapa', 'tbl_jornada_id'], ['ciclo', 'tbl_jornada_id']], omit: ['etapas'] },
  etapa: { schema: 'Etapa', label: 'Etapa', fks: { tbl_jornada_id: 'jornada' }, children: [['etapaCiclo', 'etapa_id'], ['cadastroHorario', 'tbl_etapa_id'], ['documentoInstituicao', 'etapa_id']] },
  ciclo: { schema: 'Ciclo', label: 'Ciclo', fks: { tbl_jornada_id: 'jornada', tbl_doadora_id: 'doadora' }, children: [['etapaCiclo', 'tbl_ciclo_id'], ['agendamento', 'tbl_ciclo_id']] },
  etapaCiclo: { schema: 'EtapaCiclo', label: 'EtapaCiclo', fks: { etapa_id: 'etapa', tbl_ciclo_id: 'ciclo' }, children: [['documentoDoadora', 'tbl_etapa_ciclo_id']] },
  cadastroHorario: { schema: 'CadastroHorario', label: 'CadastroHorario', fks: { tbl_etapa_id: 'etapa' }, children: [['agendamento', 'tbl_cadastro_horario_id']] },
  statusAgendamento: { schema: 'StatusAgendamento', label: 'StatusAgendamento', fks: {}, children: [['agendamento', 'tbl_status_agendamento_id']] },
  agendamento: { schema: 'Agendamento', label: 'Agendamento', fks: { tbl_cadastro_horario_id: 'cadastroHorario', tbl_ciclo_id: 'ciclo', tbl_status_agendamento_id: 'statusAgendamento' }, children: [] },
  documentoInstituicao: { schema: 'DocumentoInstituicao', label: 'DocumentoInstituicao', fks: { etapa_id: 'etapa' }, children: [] },
  documentoDoadora: { schema: 'DocumentoDoadora', label: 'DocumentoDoadora', fks: { tbl_doadora_id: 'doadora', tbl_etapa_ciclo_id: 'etapaCiclo' }, children: [] },
};

let db = {};
let counters = {};

function reset() {
  db = buildSeed(todayInSP());
  counters = {};
  for (const [name, rows] of Object.entries(db)) {
    counters[name] = rows.reduce((m, r) => Math.max(m, r.id), 0);
  }
}
reset();

const all = (coll) => db[coll].slice().sort((a, b) => a.id - b.id);
const find = (coll, id) => db[coll].find((r) => r.id === id);
const where = (coll, pred) => all(coll).filter(pred);

/** Extrai do corpo apenas os campos do schema (sem id), na ordem do Swagger. */
function pickFields(coll, body) {
  const cfg = CONFIG[coll];
  const omit = new Set(['id', ...(cfg.omit || [])]);
  const out = {};
  for (const key of schemaProps(cfg.schema)) {
    if (omit.has(key) || body[key] === undefined || body[key] === null) continue;
    out[key] = JSON.parse(JSON.stringify(body[key]));
  }
  return out;
}

/** Monta o objeto de saída seguindo a ordem dos campos do schema do Swagger. */
function shape(coll, rec) {
  const out = { id: rec.id };
  for (const key of schemaProps(CONFIG[coll].schema)) {
    if (key === 'id' || rec[key] === undefined) continue;
    out[key] = JSON.parse(JSON.stringify(rec[key]));
  }
  if (coll === 'jornada') out.etapas = jornadaEtapas(rec.id);
  return out;
}

/** Etapas de uma jornada no formato aninhado do schema Jornada (sem id, com numero_ciclos). */
function jornadaEtapas(jornadaId) {
  return where('etapa', (e) => e.tbl_jornada_id === jornadaId).map((e) => {
    const o = {
      titulo: e.titulo,
      descricao: e.descricao,
      is_agendavel: e.is_agendavel,
      is_obrigatorio: e.is_obrigatorio,
      solicita_arquivo: e.solicita_arquivo,
      precisa_aprovacao: e.precisa_aprovacao,
    };
    if (e.material_institucional !== undefined) o.material_institucional = e.material_institucional;
    o.numero_ciclos = e.numero_ciclos ?? 1;
    return o;
  });
}

function checkBody(coll, body) {
  const errors = validate({ $ref: `#/components/schemas/${CONFIG[coll].schema}` }, body);
  if (errors.length) throw new HttpError(400, 'Invalid input', { errors });
  const cfg = CONFIG[coll];
  const fkErrors = [];
  for (const [field, target] of Object.entries(cfg.fks)) {
    if (body[field] !== undefined && body[field] !== null && !find(target, body[field])) {
      fkErrors.push(`body.${field}: registro ${body[field]} não existe (${target})`);
    }
  }
  if (coll === 'cadastroHorario' && !fkErrors.length) {
    const etapa = find('etapa', body.tbl_etapa_id);
    if (etapa && !etapa.is_agendavel) {
      fkErrors.push(`body.tbl_etapa_id: a etapa ${etapa.id} não é agendável (is_agendavel = false)`);
    }
  }
  if (fkErrors.length) throw new HttpError(400, 'Invalid input', { errors: fkErrors });
}

function normalize(coll, data) {
  if (coll === 'cadastroHorario' && data.horario) data.horario = normalizeTime(data.horario);
  return data;
}

function syncEtapas(jornadaId, etapas) {
  const existentes = where('etapa', (e) => e.tbl_jornada_id === jornadaId);
  etapas.forEach((et, i) => {
    const campos = {
      titulo: et.titulo,
      descricao: et.descricao,
      is_agendavel: et.is_agendavel,
      is_obrigatorio: et.is_obrigatorio,
      solicita_arquivo: et.solicita_arquivo,
      precisa_aprovacao: et.precisa_aprovacao,
      numero_ciclos: et.numero_ciclos,
      tbl_jornada_id: jornadaId,
    };
    if (et.material_institucional) campos.material_institucional = et.material_institucional;
    if (existentes[i]) {
      // mantém o id da etapa (e, portanto, horários/ciclos já vinculados a ela)
      for (const k of Object.keys(existentes[i])) if (k !== 'id') delete existentes[i][k];
      Object.assign(existentes[i], campos);
    } else {
      db.etapa.push({ id: ++counters.etapa, ...campos });
    }
  });
  existentes.slice(etapas.length).forEach((e) => removeCascade('etapa', e.id));
}

function create(coll, body) {
  checkBody(coll, body);
  const rec = { id: ++counters[coll], ...normalize(coll, pickFields(coll, body)) };
  db[coll].push(rec);
  if (coll === 'jornada') syncEtapas(rec.id, body.etapas);
  return shape(coll, rec);
}

function update(coll, id, body) {
  const rec = find(coll, id);
  if (!rec) throw new HttpError(404, `${CONFIG[coll].label} not found`);
  checkBody(coll, body);
  const novo = normalize(coll, pickFields(coll, body));
  if (coll === 'etapa') novo.numero_ciclos = rec.numero_ciclos ?? 1; // campo interno, preservado
  for (const k of Object.keys(rec)) if (k !== 'id') delete rec[k];
  Object.assign(rec, novo);
  if (coll === 'jornada') syncEtapas(rec.id, body.etapas);
  return shape(coll, rec);
}

function removeCascade(coll, id) {
  const idx = db[coll].findIndex((r) => r.id === id);
  if (idx === -1) return;
  db[coll].splice(idx, 1);
  for (const [child, fk] of CONFIG[coll].children) {
    db[child].filter((r) => r[fk] === id).forEach((r) => removeCascade(child, r.id));
  }
}

function remove(coll, id) {
  if (!find(coll, id)) throw new HttpError(404, `${CONFIG[coll].label} not found`);
  removeCascade(coll, id);
}

module.exports = { CONFIG, HttpError, SPEC, all, find, where, shape, create, update, remove, reset, jornadaEtapas, db: () => db, nextId: (c) => ++counters[c] };
