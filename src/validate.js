'use strict';

const SPEC = require('../openapi.json');
const { isValidDate } = require('./dates');

function resolve(schema) {
  while (schema && schema.$ref) {
    schema = SPEC.components.schemas[schema.$ref.split('/').pop()];
  }
  return schema;
}

/**
 * Valida `value` contra um schema do OpenAPI (tipos, required, formatos, min/max).
 * Retorna uma lista de mensagens de erro (vazia = válido).
 * É usado tanto para validar o corpo das requisições quanto, nos testes,
 * para conferir se as respostas obedecem ao Swagger.
 */
function validate(schema, value, path = 'body', errors = []) {
  schema = resolve(schema);
  if (!schema) return errors;

  const type = schema.type || (schema.properties ? 'object' : undefined);

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${path} deve ser string`);
      } else if (schema.format === 'date' && !isValidDate(value)) {
        errors.push(`${path} deve ser uma data válida no formato YYYY-MM-DD`);
      } else if (schema.format === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
        errors.push(`${path} deve ser um horário válido no formato HH:MM ou HH:MM:SS`);
      }
      break;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`${path} deve ser um número inteiro`);
      } else {
        if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} deve ser >= ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} deve ser <= ${schema.maximum}`);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`${path} deve ser número`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path} deve ser boolean (true/false)`);
      break;
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${path} deve ser uma lista`);
      } else if (schema.items) {
        value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors));
      }
      break;
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path} deve ser um objeto`);
        break;
      }
      for (const key of schema.required || []) {
        const v = value[key];
        const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
        if (missing) errors.push(`${path}.${key} é obrigatório`);
      }
      for (const [key, sub] of Object.entries(schema.properties || {})) {
        const v = value[key];
        if (v === undefined || v === null) continue; // opcional ausente (obrigatórios já foram tratados acima)
        validate(sub, v, `${path}.${key}`, errors);
      }
      break;
    }
    default:
      break;
  }
  return errors;
}

function schemaProps(name) {
  return Object.keys(SPEC.components.schemas[name].properties);
}

module.exports = { SPEC, validate, resolve, schemaProps };
