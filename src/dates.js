'use strict';

// Todas as datas da API trafegam como string 'YYYY-MM-DD'.

const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Data de "hoje" no fuso de São Paulo (o Render roda em UTC). */
function todayInSP() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function addDays(str, n) {
  const d = new Date(str + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana que contém a data. */
function weekStart(str) {
  const dow = new Date(str + 'T00:00:00Z').getUTCDay(); // 0 = domingo
  return addDays(str, -((dow + 6) % 7));
}

/** '14:30' -> '14:30:00' ; '14:30:00' permanece igual. */
function normalizeTime(t) {
  return /^\d{2}:\d{2}$/.test(t) ? t + ':00' : t;
}

module.exports = { DIAS_CURTOS, todayInSP, isValidDate, addDays, weekStart, normalizeTime };
