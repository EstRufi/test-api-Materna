'use strict';
// Testes de ponta a ponta: sobe o servidor numa porta aleatória e confere
// (1) todas as operações do Swagger existem, (2) as respostas obedecem aos schemas,
// (3) cadastro/edição/exclusão funcionam e ficam refletidos nas consultas.
const assert = require('assert');
const server = require('../server');
const { SPEC, validate } = require('../src/validate');

let base; let pass = 0; let fail = 0;
const J = { 'Content-Type': 'application/json' };
const call = async (method, path, body, headers = J) => {
  const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : undefined, headers: r.headers };
};
async function test(name, fn) {
  try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '\n       ', e.message); }
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;

  console.log('\n[1] Todas as operações GET do Swagger respondem 200 e obedecem ao schema');
  for (const [path, ops] of Object.entries(SPEC.paths)) {
    if (!ops.get) continue;
    await test(`GET ${path}`, async () => {
      let url = path.replace(/\{[a-z_]+\}/g, path.includes('doacoes-realizadas') ? '2' : '1');
      if (path.endsWith('/agenda/resumo')) url += `?data_inicio=${today}&data_fim=${today}`;
      const r = await call('GET', url);
      assert.strictEqual(r.status, 200, `status ${r.status} ${JSON.stringify(r.body)}`);
      const schema = ops.get.responses['200'].content['application/json'].schema;
      const errs = validate(schema, r.body, 'resposta');
      assert.deepStrictEqual(errs, []);
      if (Array.isArray(r.body)) assert.ok(r.body.length <= 5, 'mais de 5 registros');
    });
  }

  console.log('\n[2] CRUD completo (POST -> GET -> PUT -> GET -> DELETE -> GET 404)');
  const novos = {
    doadora: { nome: 'Teste Silva', cpf: '000.000.000-00', data_nascimento: '2000-01-01', email: 't@t.com', senha: 'abc12345', telefone: '11900000000' },
    funcionario: { nome: 'Func Teste', cpf: '111.111.111-11', email: 'f@t.com', senha: 'abc', admin: false },
    'tipo-coleta': { tipo: 'Teste' },
    instituicao: { nome: 'Inst Teste', email: 'i@t.com', senha: 'abc', cnpj: '00.000.000/0001-00', id_coleta: 1, horarios: [{ dia_semana: 2, hora_inicio: '08:00', hora_fim: '17:00' }] },
    campanha: { titulo: 'C Teste', desc: 'desc', data_inicio: '2026-01-01', data_fim: '2026-01-31', is_ativo: true, id_instituicao: 1, tbl_funcionario_id: 1 },
    jornada: { is_ativo: true, nome: 'J Teste', desc: 'd', tbl_instituicao_id: 1, etapas: [{ titulo: 'E1', descricao: 'd', is_agendavel: true, is_obrigatorio: true, solicita_arquivo: false, precisa_aprovacao: false, numero_ciclos: 1 }] },
    etapa: { titulo: 'Et', descricao: 'd', is_agendavel: true, is_obrigatorio: false, solicita_arquivo: false, precisa_aprovacao: false, tbl_jornada_id: 1 },
    ciclo: { numero_ciclos: 1, is_concluido: 'Não', tbl_jornada_id: 1, tbl_doadora_id: 1 },
    'etapa-ciclo': { etapa_id: 1, tbl_ciclo_id: 1, data_conclusao: '2026-09-29' },
    'cadastro-horario': { dia: today, horario: '16:00', tbl_etapa_id: 3 },
    'status-agendamento': { status: 'Reagendado' },
    agendamento: { tbl_cadastro_horario_id: 4, tbl_ciclo_id: 1, tbl_status_agendamento_id: 2 },
    'documento-instituicao': { documento: 'https://exemplo.com/x.pdf', etapa_id: 1 },
    'documento-doadora': { documento: 'https://exemplo.com/y.pdf', tbl_doadora_id: 1, tbl_etapa_ciclo_id: 1 },
  };
  const edits = {
    doadora: { nome: 'Teste Editada' }, funcionario: { nome: 'Func Editado' }, 'tipo-coleta': { tipo: 'Editado' }, instituicao: { nome: 'Inst Editada' },
    campanha: { titulo: 'C Editada' }, jornada: { nome: 'J Editada' }, etapa: { titulo: 'Et Editada' }, ciclo: { is_concluido: 'Sim' },
    'etapa-ciclo': { data_conclusao: '2026-10-01' }, 'cadastro-horario': { horario: '17:30:00' }, 'status-agendamento': { status: 'Editado' },
    agendamento: { tbl_status_agendamento_id: 1 }, 'documento-instituicao': { documento: 'https://exemplo.com/z.pdf' }, 'documento-doadora': { documento: 'https://exemplo.com/w.pdf' },
  };
  for (const [res, body] of Object.entries(novos)) {
    await test(`/${res}`, async () => {
      const p = `/v1/materna/${res}`;
      const c = await call('POST', p, body);
      assert.strictEqual(c.status, 201, JSON.stringify(c.body));
      const id = c.body.id; assert.ok(id);
      const g = await call('GET', `${p}/${id}`); assert.strictEqual(g.status, 200);
      const edited = { ...g.body, ...edits[res] };
      const u = await call('PUT', `${p}/${id}`, edited); assert.strictEqual(u.status, 200, JSON.stringify(u.body));
      const g2 = await call('GET', `${p}/${id}`);
      const key = Object.keys(edits[res])[0];
      assert.deepStrictEqual(g2.body[key], edited[key]);
      if (res === 'cadastro-horario') assert.strictEqual(g2.body.horario, '17:30:00');
      const d = await call('DELETE', `${p}/${id}`); assert.strictEqual(d.status, 200);
      assert.strictEqual((await call('GET', `${p}/${id}`)).status, 404);
      assert.strictEqual((await call('DELETE', `${p}/${id}`)).status, 404);
    });
  }

  console.log('\n[3] Validações e códigos de erro do Swagger');
  await test('400 campo obrigatório ausente', async () => {
    const r = await call('POST', '/v1/materna/doadora', { nome: 'x' });
    assert.strictEqual(r.status, 400); assert.ok(r.body.errors.length >= 4);
  });
  await test('400 tipo errado (numero como string)', async () => {
    const r = await call('POST', '/v1/materna/doadora', { ...novos.doadora, numero: '11' });
    assert.strictEqual(r.status, 400);
  });
  await test('400 FK inexistente', async () => {
    assert.strictEqual((await call('POST', '/v1/materna/campanha', { ...novos.campanha, id_instituicao: 999 })).status, 400);
  });
  await test('400 horário em etapa não agendável', async () => {
    assert.strictEqual((await call('POST', '/v1/materna/cadastro-horario', { ...novos['cadastro-horario'], tbl_etapa_id: 1 })).status, 400);
  });
  await test('400 ID inválido', async () => {
    assert.strictEqual((await call('GET', '/v1/materna/doadora/abc')).status, 400);
    assert.strictEqual((await call('PUT', '/v1/materna/doadora/abc', novos.doadora)).status, 400);
  });
  await test('400 JSON malformado', async () => {
    assert.strictEqual((await call('POST', '/v1/materna/doadora', '{oops')).status, 400);
  });
  await test('415 Content-Type inválido', async () => {
    assert.strictEqual((await call('POST', '/v1/materna/doadora', 'x', { 'Content-Type': 'text/plain' })).status, 415);
    assert.strictEqual((await call('PUT', '/v1/materna/doadora/1', 'x', { 'Content-Type': 'text/plain' })).status, 415);
  });
  await test('404 PUT em ID inexistente', async () => {
    assert.strictEqual((await call('PUT', '/v1/materna/doadora/999', novos.doadora)).status, 404);
  });
  await test('400 agenda/resumo sem parâmetros / 404 período vazio', async () => {
    assert.strictEqual((await call('GET', '/v1/materna/agenda/resumo')).status, 400);
    assert.strictEqual((await call('GET', '/v1/materna/agenda/resumo?data_inicio=2000-01-01&data_fim=2000-01-07')).status, 404);
  });
  await test('CORS: preflight OPTIONS e cabeçalhos', async () => {
    const r = await fetch(base + '/v1/materna/doadora', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT' } });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
    assert.ok(r.headers.get('access-control-allow-methods').includes('DELETE'));
  });

  console.log('\n[4] Coerência entre rotas (dashboard / agenda / doadora)');
  await test('dashboard reflete os agendamentos de hoje', async () => {
    const r = await call('GET', '/v1/materna/dashboard');
    assert.deepStrictEqual(r.body.resumo, { agendamentos_hoje: 2, confirmados: 1, pendentes: 1, cancelados: 1 });
    assert.strictEqual(r.body.agenda_hoje.length, 2);
    assert.strictEqual(r.body.agendamentos_semana.length, 7);
    assert.ok(r.body.doadoras_em_jornada.find((d) => d.nome === 'Maria Silva').progresso === 67);
  });
  await test('novo agendamento aparece no dashboard, na agenda e na doadora', async () => {
    const a = await call('POST', '/v1/materna/agendamento', { tbl_cadastro_horario_id: 4, tbl_ciclo_id: 4, tbl_status_agendamento_id: 2 });
    assert.strictEqual(a.status, 201);
    const dash = await call('GET', '/v1/materna/dashboard');
    assert.strictEqual(dash.body.resumo.agendamentos_hoje, 3);
    const ag = await call('GET', `/v1/materna/agendamento?data=${today}`);
    assert.ok(ag.body.find((x) => x.id_agendamento === a.body.id && x.doadora.nome === 'Fernanda Lima'));
    const h = await call('GET', `/v1/materna/cadastro-horario?data=${today}&etapa_id=5`);
    assert.strictEqual(h.body[0].total_agendamentos, 1);
    const da = await call('GET', '/v1/materna/doadora/4/agendamentos');
    assert.ok(da.body.find((x) => x.id_agendamento === a.body.id));
    await call('DELETE', `/v1/materna/agendamento/${a.body.id}`);
    assert.strictEqual((await call('GET', '/v1/materna/dashboard')).body.resumo.agendamentos_hoje, 2);
  });
  await test('doações realizadas (Ana) e vazio (Maria -> 404)', async () => {
    const r = await call('GET', '/v1/materna/doadora/2/doacoes-realizadas');
    assert.strictEqual(r.body[0].instituicao.nome, 'BLH Hospital Santa Aurora');
    assert.strictEqual((await call('GET', '/v1/materna/doadora/1/doacoes-realizadas')).status, 404);
  });
  await test('POST doadora/{id}/jornada/{id} cria ciclo; 404 se não existir', async () => {
    const r = await call('POST', '/v1/materna/doadora/5/jornada/2');
    assert.strictEqual(r.status, 201);
    assert.strictEqual((await call('GET', `/v1/materna/ciclo/${r.body.id}`)).body.tbl_doadora_id, 5);
    assert.strictEqual((await call('POST', '/v1/materna/doadora/999/jornada/2')).status, 404);
    assert.strictEqual((await call('POST', '/v1/materna/doadora/x/jornada/2')).status, 400);
  });
  await test('POST jornada cria etapas e GET jornada as devolve aninhadas', async () => {
    const j = await call('POST', '/v1/materna/jornada', novos.jornada);
    const g = await call('GET', `/v1/materna/jornada/${j.body.id}`);
    assert.strictEqual(g.body.etapas.length, 1);
    const et = (await call('GET', '/v1/materna/etapa')).body;
    assert.ok(et.length > 0);
  });
  await test('exclusão em cascata: apagar doadora remove seus ciclos', async () => {
    await call('DELETE', '/v1/materna/doadora/3');
    assert.strictEqual((await call('GET', '/v1/materna/ciclo/3')).status, 404);
    assert.strictEqual((await call('GET', '/v1/materna/doadora/3/agendamentos')).status, 404);
  });
  await test('reset restaura os dados', async () => {
    await call('POST', '/_dev/reset');
    assert.strictEqual((await call('GET', '/v1/materna/doadora/3')).status, 200);
  });

  console.log(`\nResultado: ${pass} ok, ${fail} falha(s)`);
  server.close();
  process.exit(fail ? 1 : 0);
})();
