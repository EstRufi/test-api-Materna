'use strict';

const { addDays } = require('./dates');

const avatar = (nome) =>
  `https://ui-avatars.com/api/?background=f4b6c2&color=7a1f3d&size=256&name=${encodeURIComponent(nome)}`;
const banner = (txt) =>
  `https://placehold.co/800x400/f4b6c2/7a1f3d?text=${encodeURIComponent(txt)}`;

/**
 * Gera os dados iniciais (máx. 5 registros por coleção).
 * As datas de horários, agendamentos e etapas concluídas são relativas a `hoje`,
 * para que dashboard e agenda sempre tenham dados "de hoje" ao iniciar o servidor.
 *
 * Mapa dos relacionamentos:
 *  - Jornada 1 (Instituição 1): etapas 1 Conheça a doação -> 2 Envio de documentos -> 3 Coleta
 *  - Jornada 2 (Instituição 2): etapas 4 Orientação e exames -> 5 Coleta
 *  - Ciclos: 1 Maria/J1 (em andamento) | 2 Ana/J2 (concluído) | 3 Juliana/J2 | 4 Fernanda/J2 | 5 Camila/J1
 */
function buildSeed(hoje) {
  return {
    tipoColeta: [
      { id: 1, tipo: 'Domiciliar' },
      { id: 2, tipo: 'Presencial' },
      { id: 3, tipo: 'Ponto de coleta' },
    ],

    instituicao: [
      {
        id: 1,
        nome: 'Banco de Leite Humano Materna Esperança',
        foto: avatar('BLH Esperança'),
        email: 'contato@blhesperanca.org.br',
        senha: 'esperanca123',
        cnpj: '12.345.678/0001-90',
        id_coleta: 1,
        telefone: '11-4141-2020',
        cep: '06653-020',
        logradouro: 'Rua Joaquim Marques',
        numero: '120',
        complemento: 'Bloco B',
        bairro: 'Centro',
        cidade: 'Itapevi',
        uf: 'SP',
        horarios: [2, 3, 4, 5, 6].map((d) => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '17:00' })),
      },
      {
        id: 2,
        nome: 'BLH Hospital Santa Aurora',
        foto: avatar('BLH Santa Aurora'),
        email: 'blh@santaaurora.org.br',
        senha: 'aurora123',
        cnpj: '23.456.789/0001-01',
        id_coleta: 2,
        telefone: '11-3699-4500',
        cep: '06020-010',
        logradouro: 'Av. dos Autonomistas',
        numero: '1500',
        complemento: 'Térreo',
        bairro: 'Vila Yara',
        cidade: 'Osasco',
        uf: 'SP',
        horarios: [2, 3, 4, 5, 6, 7].map((d) => ({
          dia_semana: d,
          hora_inicio: d === 7 ? '08:00' : '07:30',
          hora_fim: d === 7 ? '12:00' : '18:00',
        })),
      },
      {
        id: 3,
        nome: 'Posto de Coleta Gota de Vida',
        foto: avatar('Gota de Vida'),
        email: 'contato@gotadevida.org.br',
        senha: 'gota123',
        cnpj: '34.567.890/0001-12',
        id_coleta: 3,
        telefone: '11-4198-7700',
        cep: '06401-000',
        logradouro: 'Alameda Rio Negro',
        numero: '585',
        complemento: 'Sala 3',
        bairro: 'Alphaville',
        cidade: 'Barueri',
        uf: 'SP',
        horarios: [3, 5].map((d) => ({ dia_semana: d, hora_inicio: '09:00', hora_fim: '15:00' })),
      },
    ],

    funcionario: [
      { id: 1, nome: 'Carlos Souza', cpf: '987.654.321-00', data_nascimento: '1985-03-12', email: 'carlos.souza@blhesperanca.org.br', senha: 'carlos123', admin: true },
      { id: 2, nome: 'Patrícia Mendes', cpf: '321.654.987-11', data_nascimento: '1990-07-22', email: 'patricia.mendes@blhesperanca.org.br', senha: 'patricia123', admin: false },
      { id: 3, nome: 'Rafael Oliveira', cpf: '456.789.123-22', data_nascimento: '1993-11-05', email: 'rafael.oliveira@santaaurora.org.br', senha: 'rafael123', admin: false },
      { id: 4, nome: 'Beatriz Nogueira', cpf: '654.987.321-33', data_nascimento: '1988-01-30', email: 'beatriz.nogueira@santaaurora.org.br', senha: 'beatriz123', admin: true },
    ],

    doadora: [
      { id: 1, nome: 'Maria Silva', cpf: '123.456.789-00', foto: avatar('Maria Silva'), data_nascimento: '1995-04-20', email: 'maria.silva@email.com', senha: 'maria123', telefone: '11949491088', cep: '06653-036', estado: 'SP', cidade: 'Itapevi', endereco: 'Av. Castelo Branco', numero: 11, complemento: '9A' },
      { id: 2, nome: 'Ana Souza', cpf: '234.567.890-11', foto: avatar('Ana Souza'), data_nascimento: '1992-09-14', email: 'ana.souza@email.com', senha: 'ana12345', telefone: '11958273341', cep: '06020-050', estado: 'SP', cidade: 'Osasco', endereco: 'Rua Antônio Agu', numero: 230, complemento: 'Apto 41' },
      { id: 3, nome: 'Juliana Pereira', cpf: '345.678.901-22', foto: avatar('Juliana Pereira'), data_nascimento: '1998-12-02', email: 'juliana.pereira@email.com', senha: 'juliana123', telefone: '11967584420', cep: '06401-020', estado: 'SP', cidade: 'Barueri', endereco: 'Rua Marte', numero: 78, complemento: 'Casa 2' },
      { id: 4, nome: 'Fernanda Lima', cpf: '456.789.012-33', foto: avatar('Fernanda Lima'), data_nascimento: '1996-06-18', email: 'fernanda.lima@email.com', senha: 'fernanda123', telefone: '11971236655', cep: '06693-000', estado: 'SP', cidade: 'Itapevi', endereco: 'Rua Pedro Dias', numero: 405, complemento: 'Fundos' },
      { id: 5, nome: 'Camila Rocha', cpf: '567.890.123-44', foto: avatar('Camila Rocha'), data_nascimento: '1999-02-27', email: 'camila.rocha@email.com', senha: 'camila123', telefone: '11982345566', cep: '06650-010', estado: 'SP', cidade: 'Itapevi', endereco: 'Rua das Acácias', numero: 52, complemento: 'Bloco C, Apto 12' },
    ],

    campanha: [
      { id: 1, titulo: 'Agosto Dourado', desc: 'Campanha de incentivo à doação de leite materno e ao aleitamento.', foto: banner('Agosto Dourado'), data_inicio: '2026-08-01', data_fim: '2026-08-31', is_ativo: false, id_instituicao: 1, tbl_funcionario_id: 1 },
      { id: 2, titulo: 'Doe Leite, Salve Vidas', desc: 'Mutirão permanente para abastecer o estoque de leite humano para bebês prematuros.', foto: banner('Doe Leite, Salve Vidas'), data_inicio: '2026-09-01', data_fim: '2026-12-31', is_ativo: true, id_instituicao: 1, tbl_funcionario_id: 2 },
      { id: 3, titulo: 'Outubro Solidário', desc: 'Doadoras do mês recebem kit de acolhimento e orientação com enfermeira.', foto: banner('Outubro Solidário'), data_inicio: '2026-10-01', data_fim: '2026-10-31', is_ativo: true, id_instituicao: 2, tbl_funcionario_id: 4 },
      { id: 4, titulo: 'Natal de Esperança', desc: 'Coleta especial de fim de ano para manter os estoques durante as festas.', foto: banner('Natal de Esperança'), data_inicio: '2026-12-01', data_fim: '2026-12-31', is_ativo: false, id_instituicao: 2, tbl_funcionario_id: 3 },
    ],

    jornada: [
      { id: 1, is_ativo: true, nome: 'Jornada padrão da doadora', desc: 'Acompanha a doadora desde a orientação até a coleta', tbl_instituicao_id: 1 },
      { id: 2, is_ativo: true, nome: 'Jornada Santa Aurora', desc: 'Orientação com exames e coleta no Hospital Santa Aurora', tbl_instituicao_id: 2 },
    ],

    // numero_ciclos é guardado aqui, mas só aparece dentro de GET /jornada (conforme o Swagger)
    etapa: [
      { id: 1, titulo: 'Conheça a doação', descricao: 'Material introdutório sobre a doação de leite materno.', is_agendavel: false, is_obrigatorio: false, solicita_arquivo: false, precisa_aprovacao: false, material_institucional: 'https://exemplo.com/guia-doacao.pdf', tbl_jornada_id: 1, numero_ciclos: 1 },
      { id: 2, titulo: 'Envio de documentos', descricao: 'Envie os documentos solicitados para análise da equipe.', is_agendavel: false, is_obrigatorio: true, solicita_arquivo: true, precisa_aprovacao: true, material_institucional: 'https://exemplo.com/lista-documentos.pdf', tbl_jornada_id: 1, numero_ciclos: 1 },
      { id: 3, titulo: 'Coleta', descricao: 'Agende a coleta do leite materno.', is_agendavel: true, is_obrigatorio: true, solicita_arquivo: false, precisa_aprovacao: false, material_institucional: 'https://exemplo.com/Guia_Instrucoes_Coleta_Materna_v2.pdf', tbl_jornada_id: 1, numero_ciclos: 1 },
      { id: 4, titulo: 'Orientação e exames', descricao: 'Consulta de orientação com enfermeira e envio dos exames.', is_agendavel: true, is_obrigatorio: true, solicita_arquivo: true, precisa_aprovacao: true, material_institucional: 'https://exemplo.com/orientacao-exames.pdf', tbl_jornada_id: 2, numero_ciclos: 1 },
      { id: 5, titulo: 'Coleta', descricao: 'Agende a coleta do leite materno no hospital.', is_agendavel: true, is_obrigatorio: true, solicita_arquivo: false, precisa_aprovacao: false, material_institucional: 'https://exemplo.com/guia-coleta-hospital.pdf', tbl_jornada_id: 2, numero_ciclos: 1 },
    ],

    ciclo: [
      { id: 1, numero_ciclos: 1, is_concluido: 'Não', tbl_jornada_id: 1, tbl_doadora_id: 1 },
      { id: 2, numero_ciclos: 1, is_concluido: 'Sim', tbl_jornada_id: 2, tbl_doadora_id: 2 },
      { id: 3, numero_ciclos: 1, is_concluido: 'Não', tbl_jornada_id: 2, tbl_doadora_id: 3 },
      { id: 4, numero_ciclos: 1, is_concluido: 'Não', tbl_jornada_id: 2, tbl_doadora_id: 4 },
      { id: 5, numero_ciclos: 1, is_concluido: 'Não', tbl_jornada_id: 1, tbl_doadora_id: 5 },
    ],

    etapaCiclo: [
      { id: 1, data_conclusao: addDays(hoje, -10), etapa_id: 1, tbl_ciclo_id: 1 }, // Maria: conheceu a doação
      { id: 2, data_conclusao: addDays(hoje, -5), etapa_id: 2, tbl_ciclo_id: 1 }, //  Maria: documentos aprovados
      { id: 3, data_conclusao: addDays(hoje, -20), etapa_id: 4, tbl_ciclo_id: 2 }, // Ana: orientação e exames
      { id: 4, data_conclusao: addDays(hoje, -2), etapa_id: 5, tbl_ciclo_id: 2 }, //  Ana: coleta (ciclo concluído)
      { id: 5, data_conclusao: addDays(hoje, -1), etapa_id: 1, tbl_ciclo_id: 5 }, //  Camila: conheceu a doação
    ],

    documentoDoadora: [
      { id: 1, documento: 'https://exemplo.com/docs/maria-silva-rg.pdf', tbl_doadora_id: 1, tbl_etapa_ciclo_id: 2, motivo_recusa: 'Documento ilegível' },
      { id: 2, documento: 'https://exemplo.com/docs/maria-silva-rg-v2.pdf', tbl_doadora_id: 1, tbl_etapa_ciclo_id: 2 },
      { id: 3, documento: 'https://exemplo.com/docs/ana-souza-exames.pdf', tbl_doadora_id: 2, tbl_etapa_ciclo_id: 3 },
      { id: 4, documento: 'https://exemplo.com/docs/ana-souza-cartao-pre-natal.pdf', tbl_doadora_id: 2, tbl_etapa_ciclo_id: 3 },
    ],

    documentoInstituicao: [
      { id: 1, documento: 'https://exemplo.com/docs/blh-esperanca-guia-doacao.pdf', etapa_id: 1 },
      { id: 2, documento: 'https://exemplo.com/docs/blh-esperanca-guia-coleta.pdf', etapa_id: 3 },
      { id: 3, documento: 'https://exemplo.com/docs/santa-aurora-guia-coleta.pdf', etapa_id: 5 },
    ],

    statusAgendamento: [
      { id: 1, status: 'Pendente' },
      { id: 2, status: 'Confirmado' },
      { id: 3, status: 'Cancelado' },
      { id: 4, status: 'Concluído' },
    ],

    cadastroHorario: [
      { id: 1, dia: addDays(hoje, -2), horario: '09:00:00', tbl_etapa_id: 5 }, // Coleta (Santa Aurora), já realizada
      { id: 2, dia: hoje, horario: '09:00:00', tbl_etapa_id: 4 }, //              Orientação (Santa Aurora)
      { id: 3, dia: hoje, horario: '10:30:00', tbl_etapa_id: 3 }, //              Coleta (Esperança)
      { id: 4, dia: hoje, horario: '14:00:00', tbl_etapa_id: 5 }, //              Coleta (Santa Aurora) - horário livre
      { id: 5, dia: addDays(hoje, 2), horario: '09:00:00', tbl_etapa_id: 4 }, //  Orientação (Santa Aurora)
    ],

    agendamento: [
      { id: 1, tbl_cadastro_horario_id: 1, tbl_ciclo_id: 2, tbl_status_agendamento_id: 4 }, // Ana - coleta concluída
      { id: 2, tbl_cadastro_horario_id: 2, tbl_ciclo_id: 3, tbl_status_agendamento_id: 2 }, // Juliana - confirmado hoje
      { id: 3, tbl_cadastro_horario_id: 3, tbl_ciclo_id: 1, tbl_status_agendamento_id: 1 }, // Maria - pendente hoje
      { id: 4, tbl_cadastro_horario_id: 2, tbl_ciclo_id: 4, tbl_status_agendamento_id: 3 }, // Fernanda - cancelou hoje
      { id: 5, tbl_cadastro_horario_id: 5, tbl_ciclo_id: 4, tbl_status_agendamento_id: 1 }, // Fernanda - reagendou
    ],
  };
}

module.exports = { buildSeed };
