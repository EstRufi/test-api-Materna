'use strict';

const store = require('./store');
const { HttpError, CONFIG } = store;
const { DIAS_CURTOS, todayInSP, isValidDate, addDays, weekStart } = require('./dates');

const BASE = '/v1/materna';

const parseId = (v) => {
  if (!/^\d+$/.test(String(v)) || Number(v) < 1) throw new HttpError(400, 'Invalid ID supplied');
  return Number(v);
};
const notFound = (msg = 'Not Found') => new HttpError(404, msg);

const routes = [];
const add = (method, path, handler, hasBody = false) => routes.push({ method, path, handler, hasBody });

/* ---------- CRUD genérico (conforme o Swagger) ---------- */
function crud(path, coll) {
  const label = CONFIG[coll].label;
  add('POST', `${BASE}/${path}`, ({ body }) => ({ status: 201, data: store.create(coll, body) }), true);
  add('GET', `${BASE}/${path}`, () => {
    const rows = store.all(coll);
    if (!rows.length) throw notFound();
    return { data: rows.map((r) => store.shape(coll, r)) };
  });
  add('GET', `${BASE}/${path}/:id`, ({ params }) => {
    const rec = store.find(coll, parseId(params.id));
    if (!rec) throw notFound();
    return { data: store.shape(coll, rec) };
  });
  add('PUT', `${BASE}/${path}/:id`, ({ params, body }) => ({ data: store.update(coll, parseId(params.id), body) }), true);
  add('DELETE', `${BASE}/${path}/:id`, ({ params }) => {
    store.remove(coll, parseId(params.id));
    return { data: { message: `${label} excluído(a) com sucesso` } };
  });
}

/* ---------- Helpers de leitura ---------- */
const statusNome = (ag) => store.find('statusAgendamento', ag.tbl_status_agendamento_id)?.status ?? null;

function contexto(ag) {
  const horario = store.find('cadastroHorario', ag.tbl_cadastro_horario_id);
  const ciclo = store.find('ciclo', ag.tbl_ciclo_id);
  const doadora = ciclo && store.find('doadora', ciclo.tbl_doadora_id);
  const etapa = horario && store.find('etapa', horario.tbl_etapa_id);
  const jornada = etapa && store.find('jornada', etapa.tbl_jornada_id);
  const instituicao = jornada && store.find('instituicao', jornada.tbl_instituicao_id);
  return { horario, ciclo, doadora, etapa, jornada, instituicao, status: statusNome(ag) };
}

const ehStatus = (ag, nome) => (statusNome(ag) || '').toLowerCase() === nome.toLowerCase();

function atendimentos(dia) {
  return store
    .all('agendamento')
    .map((ag) => ({ ag, c: contexto(ag) }))
    .filter(({ c }) => c.horario && c.doadora && c.etapa && (!dia || c.horario.dia === dia))
    .sort((a, b) => (a.c.horario.dia + a.c.horario.horario).localeCompare(b.c.horario.dia + b.c.horario.horario) || a.ag.id - b.ag.id);
}

function progresso(ciclo) {
  const etapas = store.where('etapa', (e) => e.tbl_jornada_id === ciclo.tbl_jornada_id);
  if (!etapas.length) return 0;
  const feitas = new Set(
    store.where('etapaCiclo', (ec) => ec.tbl_ciclo_id === ciclo.id && ec.data_conclusao).map((ec) => ec.etapa_id)
  );
  const n = etapas.filter((e) => feitas.has(e.id)).length;
  return Math.round((n / etapas.length) * 100);
}

/* ---------- Recursos CRUD ---------- */
crud('doadora', 'doadora');
crud('funcionario', 'funcionario');
crud('tipo-coleta', 'tipoColeta');
crud('instituicao', 'instituicao');
crud('campanha', 'campanha');
crud('jornada', 'jornada');
crud('etapa', 'etapa');
crud('ciclo', 'ciclo');
crud('etapa-ciclo', 'etapaCiclo');
crud('status-agendamento', 'statusAgendamento');
crud('documento-instituicao', 'documentoInstituicao');
crud('documento-doadora', 'documentoDoadora');

/* ---------- Agendamento: GET (lista) tem formato próprio ---------- */
add('POST', `${BASE}/agendamento`, ({ body }) => ({ status: 201, data: store.create('agendamento', body) }), true);
add('GET', `${BASE}/agendamento`, ({ query }) => {
  if (query.data !== undefined && !isValidDate(query.data)) throw new HttpError(400, 'Parâmetro "data" inválido (use YYYY-MM-DD)');
  const rows = atendimentos(query.data).map(({ ag, c }) => ({
    id_agendamento: ag.id,
    horario: c.horario.horario,
    doadora: { id: c.doadora.id, nome: c.doadora.nome },
    etapa: { id: c.etapa.id, titulo: c.etapa.titulo },
    status: c.status,
  }));
  if (!rows.length) throw notFound('Nenhum atendimento encontrado');
  return { data: rows };
});
add('GET', `${BASE}/agendamento/:id`, ({ params }) => {
  const rec = store.find('agendamento', parseId(params.id));
  if (!rec) throw notFound();
  return { data: store.shape('agendamento', rec) };
});
add('PUT', `${BASE}/agendamento/:id`, ({ params, body }) => ({ data: store.update('agendamento', parseId(params.id), body) }), true);
add('DELETE', `${BASE}/agendamento/:id`, ({ params }) => {
  store.remove('agendamento', parseId(params.id));
  return { data: { message: 'Agendamento excluído com sucesso' } };
});

/* ---------- Cadastro de horário: GET (lista) tem formato próprio ---------- */
add('POST', `${BASE}/cadastro-horario`, ({ body }) => ({ status: 201, data: store.create('cadastroHorario', body) }), true);
add('GET', `${BASE}/cadastro-horario`, ({ query }) => {
  if (query.data !== undefined && !isValidDate(query.data)) throw new HttpError(400, 'Parâmetro "data" inválido (use YYYY-MM-DD)');
  let etapaId;
  if (query.etapa_id !== undefined) etapaId = parseId(query.etapa_id);
  const rows = store
    .where('cadastroHorario', (h) => (!query.data || h.dia === query.data) && (!etapaId || h.tbl_etapa_id === etapaId))
    .sort((a, b) => (a.dia + a.horario).localeCompare(b.dia + b.horario) || a.id - b.id)
    .map((h) => {
      const etapa = store.find('etapa', h.tbl_etapa_id);
      const ags = store.where('agendamento', (a) => a.tbl_cadastro_horario_id === h.id).map((a) => {
        const ciclo = store.find('ciclo', a.tbl_ciclo_id);
        const d = ciclo && store.find('doadora', ciclo.tbl_doadora_id);
        return { id: a.id, doadora: { id: d?.id ?? null, nome: d?.nome ?? null }, status: statusNome(a) };
      });
      return {
        id_horario: h.id,
        dia: h.dia,
        horario: h.horario,
        etapa: { id: etapa?.id ?? null, titulo: etapa?.titulo ?? null },
        agendamentos: ags,
        total_agendamentos: ags.length,
      };
    });
  if (!rows.length) throw notFound('Nenhum horário encontrado');
  return { data: rows };
});
add('GET', `${BASE}/cadastro-horario/:id`, ({ params }) => {
  const rec = store.find('cadastroHorario', parseId(params.id));
  if (!rec) throw notFound();
  return { data: store.shape('cadastroHorario', rec) };
});
add('PUT', `${BASE}/cadastro-horario/:id`, ({ params, body }) => ({ data: store.update('cadastroHorario', parseId(params.id), body) }), true);
add('DELETE', `${BASE}/cadastro-horario/:id`, ({ params }) => {
  store.remove('cadastroHorario', parseId(params.id));
  return { data: { message: 'CadastroHorario excluído com sucesso' } };
});

/* ---------- Dashboard ---------- */
add('GET', `${BASE}/dashboard`, ({ query }) => {
  const data = query.data === undefined ? todayInSP() : query.data;
  if (!isValidDate(data)) throw new HttpError(400, 'Parâmetro "data" inválido (use YYYY-MM-DD)');

  if (!store.all('cadastroHorario').length && !store.all('agendamento').length && !store.all('ciclo').length) {
    throw notFound('Dados não encontrados');
  }

  const doDia = atendimentos(data);
  const ativosDoDia = doDia.filter(({ ag }) => !ehStatus(ag, 'Cancelado'));

  const inicio = weekStart(data);
  const semana = DIAS_CURTOS.map((dia, i) => {
    const d = addDays(inicio, i);
    return { dia, quantidade: atendimentos(d).filter(({ ag }) => !ehStatus(ag, 'Cancelado')).length };
  });

  const emJornada = store
    .where('ciclo', (c) => (c.is_concluido || '').toLowerCase() !== 'sim')
    .map((c) => ({ c, d: store.find('doadora', c.tbl_doadora_id) }))
    .filter(({ d }) => d)
    .map(({ c, d }) => ({ id: d.id, nome: d.nome, progresso: progresso(c) }));

  return {
    data: {
      resumo: {
        agendamentos_hoje: ativosDoDia.length,
        confirmados: doDia.filter(({ ag }) => ehStatus(ag, 'Confirmado')).length,
        pendentes: doDia.filter(({ ag }) => ehStatus(ag, 'Pendente')).length,
        cancelados: doDia.filter(({ ag }) => ehStatus(ag, 'Cancelado')).length,
      },
      agendamentos_semana: semana,
      doadoras_em_jornada: emJornada,
      agenda_hoje: ativosDoDia.map(({ ag, c }) => ({
        id_agendamento: ag.id,
        horario: c.horario.horario,
        doadora: { id: c.doadora.id, nome: c.doadora.nome },
        etapa: { id: c.etapa.id, titulo: c.etapa.titulo },
        status: c.status,
      })),
    },
  };
});

/* ---------- Resumo da agenda ---------- */
add('GET', `${BASE}/agenda/resumo`, ({ query }) => {
  const { data_inicio: ini, data_fim: fim } = query;
  const errors = [];
  if (!ini) errors.push('query.data_inicio é obrigatório');
  else if (!isValidDate(ini)) errors.push('query.data_inicio deve estar no formato YYYY-MM-DD');
  if (!fim) errors.push('query.data_fim é obrigatório');
  else if (!isValidDate(fim)) errors.push('query.data_fim deve estar no formato YYYY-MM-DD');
  if (!errors.length && ini > fim) errors.push('data_inicio não pode ser maior que data_fim');
  if (errors.length) throw new HttpError(400, 'Invalid input', { errors });

  const n = store.where('cadastroHorario', (h) => h.dia >= ini && h.dia <= fim).length;
  if (!n) throw notFound('Nenhum horário encontrado no período informado');
  return { data: { horarios_na_semana: n } };
});

/* ---------- Rotas da doadora ---------- */
add('POST', `${BASE}/doadora/:doadora_id/jornada/:jornada_id`, ({ params }) => {
  const doadoraId = parseId(params.doadora_id);
  const jornadaId = parseId(params.jornada_id);
  if (!store.find('doadora', doadoraId) || !store.find('jornada', jornadaId)) throw notFound('Doadora ou jornada não encontrada');
  const numero = store.where('ciclo', (c) => c.tbl_doadora_id === doadoraId && c.tbl_jornada_id === jornadaId).length + 1;
  const ciclo = store.create('ciclo', { numero_ciclos: numero, is_concluido: 'Não', tbl_jornada_id: jornadaId, tbl_doadora_id: doadoraId });
  return { status: 201, data: ciclo };
});

add('GET', `${BASE}/doadora/:doadora_id/agendamentos`, ({ params }) => {
  const doadoraId = parseId(params.doadora_id);
  if (!store.find('doadora', doadoraId)) throw notFound('Doadora not found');
  const rows = atendimentos()
    .filter(({ c }) => c.ciclo && c.ciclo.tbl_doadora_id === doadoraId)
    .map(({ ag, c }) => ({
      id_agendamento: ag.id,
      dia: c.horario.dia,
      horario: c.horario.horario,
      instituicao: { id: c.instituicao?.id ?? null, nome: c.instituicao?.nome ?? null },
      etapa: { id: c.etapa.id, titulo: c.etapa.titulo },
      status: c.status,
    }));
  if (!rows.length) throw notFound('Nenhum agendamento encontrado para a doadora');
  return { data: rows };
});

add('GET', `${BASE}/doadora/:doadora_id/doacoes-realizadas`, ({ params }) => {
  const doadoraId = parseId(params.doadora_id);
  if (!store.find('doadora', doadoraId)) throw notFound('Doadora not found');
  const rows = store
    .where('ciclo', (c) => c.tbl_doadora_id === doadoraId && (c.is_concluido || '').toLowerCase() === 'sim')
    .map((c) => {
      const jornada = store.find('jornada', c.tbl_jornada_id);
      const inst = jornada && store.find('instituicao', jornada.tbl_instituicao_id);
      const datas = store.where('etapaCiclo', (ec) => ec.tbl_ciclo_id === c.id && ec.data_conclusao).map((ec) => ec.data_conclusao).sort();
      return {
        id_ciclo: c.id,
        numero_ciclo: c.numero_ciclos,
        data_conclusao: datas.length ? datas[datas.length - 1] : null,
        instituicao: { id: inst?.id ?? null, nome: inst?.nome ?? null },
      };
    });
  if (!rows.length) throw notFound('Nenhuma doação realizada encontrada');
  return { data: rows };
});

/* ---------- Extra (NÃO está no Swagger): dias da semana ---------- */
// O schema HorarioFuncionamento cita "GET /dia-semana", mas a rota não está documentada.
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
add('GET', `${BASE}/dia-semana`, () => ({ data: DIAS.map((nome, i) => ({ id: i + 1, nome })) }));

module.exports = { routes, BASE };
