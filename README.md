# Materna API (mock)

API de desenvolvimento do projeto **Materna** (Banco de Leite Humano), baseada no Swagger `1.0.4.26`
(`docs/swagger7.yml`). Dados fictícios em memória, **sem dependências externas** (só Node.js 18+).

## Rodar localmente
```bash
npm start
```
- API: `http://localhost:9090/v1/materna`
- Documentação interativa: `http://localhost:9090/docs`
- Testes (63 verificações): `npm test`

## Publicar no Render
1. Crie um repositório no GitHub e envie **o conteúdo desta pasta** (`server.js`, `package.json`, `src/`, `openapi.json`, `render.yaml`...).
2. No Render: **New + → Web Service** → conecte o repositório.
3. Configure: Runtime **Node** · Build Command `npm install` · Start Command `npm start` · Plan **Free**.
   (Ou use **New + → Blueprint**, que lê o `render.yaml` automaticamente.)
4. Clique em **Create Web Service**. Quando o status ficar *Live*, a URL será algo como
   `https://materna-api.onrender.com`. Teste abrindo `https://SEU-SERVICO.onrender.com/health`.

> Plano Free: o serviço "dorme" após ~15 min sem uso (a primeira chamada demora ~30-60 s)
> e **os dados voltam ao estado inicial** sempre que ele reinicia.

## Usar no Vue
URL-base: `https://SEU-SERVICO.onrender.com/v1/materna` (local: `http://localhost:9090/v1/materna`)
```js
// src/services/api.js  (.env: VITE_API_URL=https://SEU-SERVICO.onrender.com/v1/materna)
import axios from 'axios'
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9090/v1/materna' })
// api.get('/doadora') · api.post('/doadora', {...}) · api.put('/doadora/1', {...}) · api.delete('/doadora/1')
```
CORS está liberado para qualquer origem (para restringir: variável de ambiente `CORS_ORIGIN`).

## Regras seguidas do Swagger
- Todas as rotas, métodos, parâmetros e formatos de resposta (inclui `/dashboard`, `/agenda/resumo`, `/cadastro-horario`, `/agendamento`, rotas da doadora).
- Campos obrigatórios e tipos validados → `400`; Content-Type diferente de JSON → `415`; ID inválido → `400`; inexistente → `404`.
- Listas vazias retornam `404` (o Swagger prevê 404 nas listagens).
- Máx. 5 registros por rota. Datas da agenda são relativas a "hoje" (fuso São Paulo).

## Pontos que o Swagger não define (decisões tomadas)
1. **Corpo de POST/PUT/DELETE**: não descrito. POST/PUT devolvem o objeto salvo (com `id`); DELETE devolve `{ "message": "..." }`. Erros: `{ "message": "...", "errors": [...] }`.
2. **`GET /dia-semana`**: citada em `HorarioFuncionamento`, mas não existe no Swagger. Foi criada como extra em `/v1/materna/dia-semana` → `[{ id, nome }]` (formato inventado: confirme com o grupo).
3. **Dashboard**: não recebe instituição, então considera todos os dados. `agendamentos_hoje` **não conta cancelados** (como no exemplo: 4 = 3+1, cancelados à parte). `agendamentos_semana` lista Seg–Dom. `progresso` = % de etapas concluídas da jornada. 404 só se não houver nenhum dado.
4. **`/agenda/resumo`**: a descrição fala em "agendamentos da semana", mas o schema só tem `horarios_na_semana`; foi retornado só ele.
5. **`Ciclo.is_concluido`** é string (`"Sim"`/`"Não"`), conforme o exemplo.
6. **Exclusão em cascata** (ex.: apagar doadora apaga seus ciclos/agendamentos), pois o Swagger não prevê erro de conflito. FKs inexistentes no POST/PUT → `400`.
7. **`PUT`** exige todos os campos obrigatórios (inclusive `senha`), como no schema. `POST /jornada` cria as etapas; no `PUT /jornada` elas são atualizadas por posição (mantendo os ids).
8. **`Jornada.etapas`** não tem `id` no schema; use `GET /etapa` quando precisar do id da etapa.
9. **Extras de desenvolvimento** (fora do Swagger): `POST /_dev/reset` restaura os dados; `/health`; `/docs`; `/openapi.json`.
