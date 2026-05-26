#!/usr/bin/env node

/**
 * Script para gerar senhas temporárias para todos os credores do GEPainel
 * e facilitar a migração para o nkFinance.
 * 
 * INSTRUÇÕES:
 * 1. npm install @supabase/supabase-js
 * 2. Configure SUPABASE_URL e SUPABASE_SERVICE_KEY abaixo
 * 3. node gerar-senhas-migracao.js
 * 4. O script gera: senhas-migracao.csv
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO — Preencha com as credenciais do GEPainel
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'SUA_URL_DO_GEPAINEL_AQUI';
const SUPABASE_SERVICE_KEY = 'SUA_SERVICE_KEY_DO_GEPAINEL_AQUI';

// ════════════════════════════════════════════════════════════════
// FUNÇÕES
// ════════════════════════════════════════════════════════════════

// Função de hash (mesma do GEPainel)
function hp(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex').substring(0, 8);
}

// Gera senha temporária: nk2026 + 4 dígitos
function gerarSenhaTemp() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `nk2026${randomDigits}`;
}

async function main() {
  console.log('🚀 Iniciando geração de senhas temporárias...\n');

  // Conecta ao Supabase do GEPainel
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Busca todos os usuários operadores (não-admin)
  const { data: usuarios, error } = await sb
    .from('users')
    .select('id, nome, login, email, role')
    .eq('role', 'op')  // Só operadores (credores)
    .order('nome');

  if (error) {
    console.error('❌ Erro ao buscar usuários:', error.message);
    process.exit(1);
  }

  if (!usuarios || usuarios.length === 0) {
    console.log('⚠️  Nenhum usuário encontrado.');
    process.exit(0);
  }

  console.log(`✅ ${usuarios.length} credores encontrados.\n`);

  // 2. Gera senhas temporárias e atualiza no banco
  const resultado = [];
  let sucesso = 0;
  let falhas = 0;

  for (const user of usuarios) {
    const senhaTemp = gerarSenhaTemp();
    const passHash = hp(senhaTemp);

    // Atualiza a senha no banco
    const { error: updateError } = await sb
      .from('users')
      .update({ pass_hash: passHash })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ Erro ao atualizar ${user.login}:`, updateError.message);
      falhas++;
      continue;
    }

    resultado.push({
      nome: user.nome,
      login: user.login,
      email: user.email || '',
      senha_temporaria: senhaTemp,
      nkfinance_url: 'https://nkfinance.app'
    });

    sucesso++;
    console.log(`✅ ${user.login.padEnd(20)} → ${senhaTemp}`);
  }

  console.log(`\n📊 Resumo: ${sucesso} senhas geradas, ${falhas} falhas\n`);

  // 3. Gera CSV
  const csvHeader = 'Nome,Login,Email,Senha Temporária,URL nkFinance\n';
  const csvRows = resultado.map(r => 
    `"${r.nome}","${r.login}","${r.email}","${r.senha_temporaria}","${r.nkfinance_url}"`
  ).join('\n');

  const csv = csvHeader + csvRows;

  // 4. Salva arquivo
  fs.writeFileSync('senhas-migracao.csv', csv, 'utf-8');
  console.log('✅ Arquivo gerado: senhas-migracao.csv');

  // 5. Gera também versão legível em texto
  const txtContent = [
    '═══════════════════════════════════════════════════════════',
    'SENHAS TEMPORÁRIAS - MIGRAÇÃO GEPAINEL → NKFINANCE',
    '═══════════════════════════════════════════════════════════',
    '',
    'URL: https://nkfinance.app',
    '',
    resultado.map((r, i) => 
      `${(i+1).toString().padStart(2,'0')}. ${r.nome}\n` +
      `    Login: ${r.login}\n` +
      `    Senha: ${r.senha_temporaria}\n` +
      `    Email: ${r.email || '(não cadastrado)'}\n`
    ).join('\n'),
    '═══════════════════════════════════════════════════════════',
    `Total: ${resultado.length} credores`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '═══════════════════════════════════════════════════════════'
  ].join('\n');

  fs.writeFileSync('senhas-migracao.txt', txtContent, 'utf-8');
  console.log('✅ Arquivo gerado: senhas-migracao.txt\n');

  console.log('🎉 Concluído! Compartilhe os arquivos com segurança.\n');
}

// ════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ════════════════════════════════════════════════════════════════
if (SUPABASE_URL === 'SUA_URL_DO_GEPAINEL_AQUI') {
  console.error('❌ Configure SUPABASE_URL e SUPABASE_SERVICE_KEY no script antes de executar.');
  process.exit(1);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
