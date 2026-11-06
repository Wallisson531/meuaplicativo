'use strict';
/* Meu Caixa — controle financeiro pessoal (PWA) com Supabase (login + banco de dados).
   Seções: 1) Constantes  2) Estado e tema  3) Supabase (login e dados)  4) Gráficos  5) Telas  6) Eventos */

// ========== 1) Constantes ==========
const K = { theme: 'mc.theme', legacy: 'mc.tx' };
const CAT_SAIDA = { 'Moradia': '#6c5ce7', 'Alimentação': '#e17055', 'Transporte': '#0984e3', 'Saúde': '#d63384', 'Lazer': '#f39c12', 'Educação': '#00a8a8', 'Compras': '#8e6e53', 'Contas': '#576574', 'Outros': '#95a5a6' };
const CAT_ENTRADA = ['Salário', 'Freelance', 'Investimentos', 'Outros'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const LOGO = '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#0e6b5c"/><g fill="#fff"><rect x="24" y="52" width="14" height="24" rx="4"/><rect x="43" y="36" width="14" height="40" rx="4"/><rect x="62" y="22" width="14" height="54" rx="4"/></g></svg>';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = n => String(n).padStart(2, '0');
const corCat = c => CAT_SAIDA[c] || '#95a5a6';
const vazio = t => `<div class="empty">${t}</div>`;

// ========== 2) Estado e tema ==========
const hoje = new Date();
const dataHoje = () => `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
// S guarda tudo que a tela precisa. tx = lançamentos já carregados do banco.
const S = { tx: [], uid: null, y: hoje.getFullYear(), m: hoje.getMonth(), tab: 'home', flt: 'all', q: '', typ: 'out', edit: null, modo: 'login', msg: '', reset: false, boot: true, load: false, fatal: '' };
let sb = null, user = null;
const getUser = () => ({ name: (user && user.user_metadata && user.user_metadata.nome) || (user && user.email) || '' });
const doMes = (y = S.y, m = S.m) => S.tx.filter(t => t.dt.startsWith(`${y}-${pad(m + 1)}`));
const soma = (l, t) => l.filter(x => x.t === t).reduce((a, x) => a + x.v, 0);
const porData = (a, b) => b.dt.localeCompare(a.dt) || String(b.at).localeCompare(String(a.at));

const tema = () => { try { return localStorage.getItem(K.theme) || 'auto'; } catch (e) { return 'auto'; } };
const mq = matchMedia('(prefers-color-scheme: dark)');
function aplicarTema() { const p = tema(); document.documentElement.dataset.theme = p === 'auto' ? (mq.matches ? 'dark' : 'light') : p; }
mq.addEventListener('change', aplicarTema);
const antigos = () => { try { const a = JSON.parse(localStorage.getItem(K.legacy)); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

// ========== 3) Supabase: login e dados ==========
const CFG = window.APP_CONFIG || {};
const configOk = () => CFG.SUPABASE_URL && CFG.SUPABASE_KEY && !/COLE_AQUI/.test(CFG.SUPABASE_URL + CFG.SUPABASE_KEY);
let tt;
function aviso(m, ruim) { const el = $('#toast'); el.textContent = m; el.className = 'on' + (ruim ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => el.className = '', 3500); }
const erro = m => { const el = $('#err'); if (el) el.textContent = m; else aviso(m, true); };
function msgErro(e) {
  const m = ((e && e.message) || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (m.includes('already registered')) return 'Este e-mail já tem conta. Use Entrar.';
  if (m.includes('at least')) return 'A senha precisa ter 6 ou mais caracteres.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet.';
  if (m.includes('different from') || m.includes('same password')) return 'Use uma senha diferente da atual.';
  return 'Algo deu errado: ' + ((e && e.message) || 'erro desconhecido');
}
// Executa uma ação de botão: bloqueia o botão, mostra erros em português.
async function acao(btn, fn) {
  const txt = btn.textContent, el = $('#err'); if (el) el.textContent = '';
  btn.disabled = true; btn.textContent = 'Aguarde…';
  try { await fn(btn); } catch (e) { erro(msgErro(e)); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = txt; } }
}
// Tradução entre o banco (português) e o app (nomes curtos)
const deLinha = r => ({ id: r.id, t: r.tipo, v: Number(r.valor), d: r.descricao || '', c: r.categoria, dt: r.data, at: r.criado_em || '' });
const paraLinha = o => ({ tipo: o.t, valor: o.v, descricao: String(o.d || '').slice(0, 200), categoria: o.c, data: o.dt });

async function carregar() {
  S.load = true; render();
  try {
    let tudo = [], de = 0;
    for (; ;) {   // o Supabase devolve no máximo 1000 linhas por pedido: buscamos em páginas
      const { data, error } = await sb.from('transacoes').select('id,tipo,valor,descricao,categoria,data,criado_em').order('data', { ascending: false }).order('criado_em', { ascending: false }).range(de, de + 999);
      if (error) throw error;
      tudo = tudo.concat(data); if (data.length < 1000) break; de += 1000;
    }
    S.tx = tudo.map(deLinha);
  } catch (e) { aviso(msgErro(e), true); }
  S.load = false; render();
}
function iniciar() {
  if (!configOk()) { S.fatal = telaMsg('Falta conectar o Supabase', 'Abra o arquivo <b>config.js</b> e cole a URL do projeto e a chave publishable. O passo a passo está no LEIA-ME.'); S.boot = false; return; }
  if (!window.supabase) { S.fatal = telaMsg('Sem conexão', 'Não foi possível carregar o Supabase. Verifique a internet e recarregue o app.'); S.boot = false; return; }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  // Disparado ao abrir o app (sessão salva), ao entrar, ao sair e ao abrir o link de redefinir senha.
  // Não chame o Supabase direto aqui dentro (use setTimeout), senão o cliente pode travar.
  sb.auth.onAuthStateChange((ev, ses) => {
    user = ses ? ses.user : null;
    if (ev === 'PASSWORD_RECOVERY') S.modo = 'recovery';
    if (!user) { S.uid = null; S.tx = []; S.boot = false; if (ev === 'SIGNED_OUT') S.modo = 'login'; render(); return; }
    if (S.uid !== user.id) { S.uid = user.id; S.boot = false; setTimeout(carregar, 0); } else render();
  });
}
async function fazerLogin() {
  const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
  if (error) throw error;
}
async function fazerCadastro() {
  const nome = $('#nm').value.trim(), email = $('#em').value.trim(), pw = $('#pw').value;
  if (nome.length < 2) return erro('Informe seu nome.');
  if (pw.length < 6) return erro('A senha precisa ter 6 ou mais caracteres.');
  if (pw !== $('#pw2').value) return erro('As senhas não coincidem.');
  const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { nome }, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  if (data.user && data.user.identities && !data.user.identities.length) return erro('Este e-mail já tem conta. Use Entrar.');
  if (!data.session) { S.modo = 'check'; S.msg = email; S.reset = false; render(); }   // confirmação de e-mail ligada
}
async function esqueci() {
  const email = $('#em').value.trim(); if (!email) return erro('Informe seu e-mail.');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
  S.modo = 'check'; S.msg = email; S.reset = true; render();
}
async function novaSenha() {
  const p = $('#pw').value;
  if (p.length < 6) return erro('A senha precisa ter 6 ou mais caracteres.');
  if (p !== $('#pw2').value) return erro('As senhas não coincidem.');
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) throw error;
  S.modo = 'login'; aviso('Senha alterada.'); render();
}
async function trocarSenha() {
  const p = $('#np').value;
  if (p.length < 6) return erro('A nova senha precisa ter 6 ou mais caracteres.');
  if (p !== $('#np2').value) return erro('As senhas não coincidem.');
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) throw error;
  $('#np').value = $('#np2').value = ''; aviso('Senha alterada.');
}
async function enviar(arr) {   // grava vários lançamentos de uma vez (backup ou dados antigos)
  const rows = arr.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.dt) && Number(x.v) > 0 && (x.t === 'in' || x.t === 'out') && x.c).map(x => paraLinha({ ...x, v: Number(x.v) }));
  if (!rows.length) return aviso('Nada para importar.', true);
  for (let i = 0; i < rows.length; i += 500) { const { error } = await sb.from('transacoes').insert(rows.slice(i, i + 500)); if (error) throw error; }
  await carregar(); aviso(`${rows.length} lançamentos importados.`);
}
async function salvarLancamento() {
  const v = numero($('#fv').value), dt = $('#fdt').value;
  if (!(v > 0)) { $('#fv').focus(); return erro('Informe um valor maior que zero.'); }
  if (!dt) return erro('Informe a data.');
  const o = { t: S.typ, v: Math.round(v * 100) / 100, d: $('#fd').value.trim(), c: $('#fc').value, dt };
  const q = S.edit ? sb.from('transacoes').update(paraLinha(o)).eq('id', S.edit.id) : sb.from('transacoes').insert(paraLinha(o));
  const { data, error } = await q.select().single();
  if (error) throw error;
  if (S.edit) Object.assign(S.edit, deLinha(data)); else S.tx.push(deLinha(data));
  const p = dt.split('-'); S.y = +p[0]; S.m = +p[1] - 1; fechar(); render();
}
async function excluir() {
  const { error } = await sb.from('transacoes').delete().eq('id', S.edit.id);
  if (error) throw error;
  S.tx = S.tx.filter(x => x !== S.edit); fechar(); render();
}
async function apagarTudo() {
  const { error } = await sb.from('transacoes').delete().eq('user_id', user.id);
  if (error) throw error;
  S.tx = []; render(); aviso('Lançamentos apagados.');
}

// ========== 4) Gráficos (SVG puro) ==========
function rosca(l) {
  const tot = soma(l, 'out'); if (!tot) return vazio('Nenhuma saída neste mês.');
  const por = {}; l.filter(x => x.t === 'out').forEach(x => por[x.c] = (por[x.c] || 0) + x.v);
  const arr = Object.entries(por).sort((a, b) => b[1] - a[1]);
  const C = 2 * Math.PI * 40; let off = 0, seg = '';
  arr.forEach(([c, v]) => { const len = v / tot * C; seg += `<circle cx="50" cy="50" r="40" fill="none" stroke="${corCat(c)}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`; off += len; });
  return `<div class="donut"><svg viewBox="0 0 100 100"><g transform="rotate(-90 50 50)">${seg}</g><text x="50" y="48" text-anchor="middle" font-size="7" fill="var(--mut)">Saídas</text><text x="50" y="58" text-anchor="middle" font-size="8" font-weight="800" fill="var(--tx)">${Math.round(tot).toLocaleString('pt-BR')}</text></svg><div class="lg">${arr.slice(0, 6).map(([c, v]) => `<div><i style="background:${corCat(c)}"></i><span>${esc(c)}</span><em>${Math.round(v / tot * 100)}%</em></div>`).join('')}</div></div>`;
}
function barras() {
  const d = []; for (let i = 5; i >= 0; i--) { const dt = new Date(S.y, S.m - i, 1), l = doMes(dt.getFullYear(), dt.getMonth()); d.push({ n: MESES[dt.getMonth()].slice(0, 3), i: soma(l, 'in'), o: soma(l, 'out') }); }
  const mx = Math.max(1, ...d.flatMap(x => [x.i, x.o])); let s = '';
  d.forEach((x, k) => { const X = k * 50 + 8, hi = x.i / mx * 100, ho = x.o / mx * 100; s += `<rect x="${X}" y="${110 - hi}" width="16" height="${hi}" rx="4" fill="var(--in)"/><rect x="${X + 18}" y="${110 - ho}" width="16" height="${ho}" rx="4" fill="var(--out)"/><text x="${X + 17}" y="128" text-anchor="middle" font-size="10" fill="var(--mut)">${x.n}</text>`; });
  return `<svg viewBox="0 0 300 134" width="100%">${s}</svg><div class="lg" style="grid-template-columns:1fr 1fr;margin-top:6px"><div><i style="background:var(--in)"></i>Entradas</div><div><i style="background:var(--out)"></i>Saídas</div></div>`;
}
function ranking(l) {
  const por = {}; l.filter(x => x.t === 'out').forEach(x => por[x.c] = (por[x.c] || 0) + x.v);
  const arr = Object.entries(por).sort((a, b) => b[1] - a[1]), tot = soma(l, 'out');
  if (!arr.length) return vazio('Sem saídas neste mês.');
  return arr.map(([c, v]) => `<div style="margin-bottom:12px"><div class="rk"><span>${esc(c)}</span><b>${brl(v)}</b></div><div class="pb"><i style="width:${v / tot * 100}%;background:${corCat(c)}"></i></div></div>`).join('');
}

// ========== 5) Telas ==========
function item(t) {
  const cor = t.t === 'in' ? 'var(--in)' : corCat(t.c);
  return `<div class="row" data-id="${t.id}"><div class="ic" style="background:${cor}">${esc(t.c[0])}</div><div class="m"><b>${esc(t.d || t.c)}</b><small>${esc(t.c)} · ${t.dt.split('-').reverse().slice(0, 2).join('/')}</small></div><div class="amt ${t.t}">${t.t === 'in' ? '+' : '−'}${brl(t.v)}</div></div>`;
}
const seletorMes = () => `<div class="mn"><button data-n="-1" aria-label="Mês anterior">‹</button><span>${MESES[S.m]} ${S.y}</span><button data-n="1" aria-label="Próximo mês">›</button></div>`;

function telaPainel() {
  const l = doMes(), ei = soma(l, 'in'), eo = soma(l, 'out'), pct = ei ? Math.min(100, eo / ei * 100) : (eo ? 100 : 0);
  const acum = S.tx.reduce((a, x) => a + (x.t === 'in' ? x.v : -x.v), 0);
  return `<div class="top"><div><div class="hi">Olá, ${esc(getUser().name.split(' ')[0])}</div><h1>Painel</h1></div>${seletorMes()}</div>
  <div class="hero"><small>Saldo do mês</small><b>${brl(ei - eo)}</b><div class="bar"><i style="width:${pct}%"></i></div><p>${ei ? `Você gastou ${Math.round(pct)}% do que recebeu.` : 'Registre uma entrada para acompanhar quanto já gastou.'}</p></div>
  <div class="two"><div class="card"><div class="k">Entradas</div><div class="v in">${brl(ei)}</div></div><div class="card"><div class="k">Saídas</div><div class="v out">${brl(eo)}</div></div></div>
  <div class="card"><h2>Para onde foi o dinheiro</h2>${rosca(l)}</div>
  <div class="card"><h2>Entradas e saídas, últimos 6 meses</h2>${barras()}</div>
  <div class="card"><div class="k">Saldo acumulado (todos os meses)</div><div class="v ${acum >= 0 ? 'in' : 'out'}">${brl(acum)}</div></div>
  <div class="card"><h2>Últimos lançamentos</h2>${l.length ? [...l].sort(porData).slice(0, 5).map(item).join('') : vazio('Toque no + para registrar o primeiro lançamento.')}</div>`;
}
function listaHtml() {
  const q = S.q.toLowerCase();
  const f = doMes().filter(x => (S.flt === 'all' || x.t === S.flt) && (!q || `${x.d} ${x.c}`.toLowerCase().includes(q))).sort(porData);
  return f.length ? f.map(item).join('') : vazio('Nenhum lançamento encontrado.');
}
function telaLista() {
  return `<div class="top"><h1>Lançamentos</h1>${seletorMes()}</div>
  <div class="chips">${[['all', 'Todos'], ['in', 'Entradas'], ['out', 'Saídas']].map(([k, n]) => `<button data-f="${k}" class="${S.flt === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  <input id="q" placeholder="Buscar por descrição ou categoria" value="${esc(S.q)}"><div class="card" id="lst">${listaHtml()}</div>`;
}
function telaRelatorios() {
  const l = doMes(), s = l.filter(x => x.t === 'out'), dias = (S.y === hoje.getFullYear() && S.m === hoje.getMonth()) ? hoje.getDate() : new Date(S.y, S.m + 1, 0).getDate();
  const maior = [...s].sort((a, b) => b.v - a.v)[0];
  return `<div class="top"><h1>Relatórios</h1>${seletorMes()}</div>
  <div class="card"><h2>Resumo do mês</h2><div class="stat"><div><div class="k">Lançamentos</div><b>${l.length}</b></div><div><div class="k">Média por dia</div><b>${brl(soma(l, 'out') / dias)}</b></div><div><div class="k">Maior saída</div><b>${maior ? brl(maior.v) : '—'}</b></div></div></div>
  <div class="card"><h2>Gastos por categoria</h2>${ranking(l)}</div>
  <div class="card"><h2>Entradas e saídas, últimos 6 meses</h2>${barras()}</div>`;
}
// Folha de cadastro/edição de lançamento
function abrirFolha(id) {
  const t = id ? S.tx.find(x => x.id == id) : null; S.edit = t;
  $('#sheet').innerHTML = `<h2>${t ? 'Editar lançamento' : 'Novo lançamento'}</h2><div class="seg"><button data-ty="out" class="o">Saída</button><button data-ty="in" class="i">Entrada</button></div>
  <label>Valor</label><input class="big" id="fv" inputmode="decimal" placeholder="0,00" value="${t ? String(t.v).replace('.', ',') : ''}"><label>Descrição</label><input id="fd" placeholder="Ex.: Mercado" value="${t ? esc(t.d) : ''}"><label>Categoria</label><select id="fc"></select><label>Data</label><input type="date" id="fdt" value="${t ? t.dt : dataHoje()}">
  <div class="err" id="err"></div><div class="btns">${t ? '<button class="btn d" data-act="del">Excluir</button>' : '<button class="btn g" data-act="close">Cancelar</button>'}<button class="btn" data-act="save">Salvar</button></div>`;
  tipo(t ? t.t : 'out', t && t.c); $('#ov').classList.add('on');
}
function tipo(ty, cat) {
  S.typ = ty;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.ty === ty));
  $('#fc').innerHTML = (ty === 'in' ? CAT_ENTRADA : Object.keys(CAT_SAIDA)).map(c => `<option${c === cat ? ' selected' : ''}>${c}</option>`).join('');
}
const fechar = () => $('#ov').classList.remove('on');
function numero(s) { s = String(s).trim(); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s); }
// ========== 5b) Telas de login, perfil e render ==========
const campo = (id, rot, tipo, ac, extra = '') => `<label for="${id}">${rot}</label><input id="${id}" type="${tipo}" autocomplete="${ac}" ${extra}>`;
const cab = (t, s) => `<div class="logo">${LOGO}</div><h1>${t}</h1><p class="note">${s}</p>`;
const telaMsg = (t, s) => `<div class="auth-box">${cab(t, s)}</div>`;
function telaAuth() {
  const m = S.modo; let h = '';
  if (m === 'login') h = cab('Bem-vindo de volta', 'Entre para ver suas finanças.') + `<form id="f-login">${campo('em', 'E-mail', 'email', 'email', 'required')}${campo('pw', 'Senha', 'password', 'current-password', 'required')}<div class="err" id="err"></div><button class="btn w">Entrar</button></form><button class="lnk" data-modo="forgot">Esqueci minha senha</button><p class="alt">Ainda não tem conta? <button class="lnk in" data-modo="reg">Criar conta</button></p>`;
  else if (m === 'reg') h = cab('Criar conta', 'Leva menos de um minuto.') + `<form id="f-reg">${campo('nm', 'Seu nome', 'text', 'name', 'required')}${campo('em', 'E-mail', 'email', 'email', 'required')}${campo('pw', 'Senha (mínimo 6 caracteres)', 'password', 'new-password', 'required')}${campo('pw2', 'Confirmar senha', 'password', 'new-password', 'required')}<div class="err" id="err"></div><button class="btn w">Criar conta</button></form><p class="alt">Já tem conta? <button class="lnk in" data-modo="login">Entrar</button></p>`;
  else if (m === 'forgot') h = cab('Redefinir senha', 'Enviaremos um link para o seu e-mail.') + `<form id="f-forgot">${campo('em', 'E-mail', 'email', 'email', 'required')}<div class="err" id="err"></div><button class="btn w">Enviar link</button></form><button class="lnk" data-modo="login">Voltar ao login</button>`;
  else if (m === 'recovery') h = cab('Nova senha', 'Escolha uma nova senha para a sua conta.') + `<form id="f-rec">${campo('pw', 'Nova senha', 'password', 'new-password', 'required')}${campo('pw2', 'Confirmar nova senha', 'password', 'new-password', 'required')}<div class="err" id="err"></div><button class="btn w">Salvar senha</button></form>`;
  else h = cab('Verifique seu e-mail', S.reset ? `Enviamos um link para redefinir a senha para <b>${esc(S.msg)}</b>.` : `Enviamos um link de confirmação para <b>${esc(S.msg)}</b>. Depois de confirmar, volte e entre.`) + '<button class="btn w" data-modo="login">Ir para o login</button>';
  return `<div class="auth-box">${h}</div>`;
}
function telaPerfil() {
  const th = tema(), n = antigos().length;
  return `<div class="top"><h1>Perfil</h1></div>
  <div class="card"><div class="k">Conta</div><div class="v">${esc(getUser().name)}</div><div class="note" style="margin:4px 0 0">${esc(user.email || '')}</div></div>
  <div class="card"><h2>Aparência</h2><div class="chips" style="margin:0">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, nm]) => `<button data-th="${k}" class="${th === k ? 'on' : ''}">${nm}</button>`).join('')}</div></div>
  <div class="card"><h2>Alterar senha</h2><form id="chpw">${campo('np', 'Nova senha', 'password', 'new-password')}${campo('np2', 'Confirmar nova senha', 'password', 'new-password')}<div class="err" id="err"></div><button class="btn w">Salvar nova senha</button></form></div>
  <div class="card"><h2>Seus dados</h2><p class="note">Seus lançamentos ficam salvos na nuvem (Supabase) e só você acessa.</p><div class="btns"><button class="btn g" data-act="exp">Exportar backup</button><button class="btn g" data-act="imp">Importar</button></div>${n ? `<button class="btn g w" style="margin-top:10px" data-act="legacy">Enviar ${n} lançamentos salvos neste aparelho</button>` : ''}<input type="file" id="file" accept=".json,application/json" hidden></div>
  <div class="card"><button class="btn g w" data-act="logout" style="margin-bottom:10px">Sair da conta</button><button class="btn d w" data-act="wipe">Apagar todos os lançamentos</button></div>`;
}
function render() {
  aplicarTema();
  const dentro = user && S.modo !== 'recovery' && !S.fatal;
  document.body.classList.toggle('auth', !dentro || (S.load && !S.tx.length));
  document.body.classList.toggle('hidefab', S.tab === 'me' || S.tab === 'rep');
  if (S.fatal) { $('#app').innerHTML = S.fatal; return; }
  if (S.boot || (dentro && S.load && !S.tx.length)) { $('#app').innerHTML = telaMsg('Meu Caixa', 'Carregando…'); return; }
  if (!dentro) { $('#app').innerHTML = telaAuth(); return; }
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab));
  $('#app').innerHTML = { home: telaPainel, list: telaLista, rep: telaRelatorios, me: telaPerfil }[S.tab]();
}
function exportar() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ v: 1, tx: S.tx.map(({ t, v, d, c, dt }) => ({ t, v, d, c, dt })) }, null, 1)], { type: 'application/json' }));
  a.download = `meu-caixa-${dataHoje()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importar(file) {
  const r = new FileReader();
  r.onload = async () => {
    try {
      const d = JSON.parse(r.result), arr = Array.isArray(d) ? d : d.tx;
      if (!Array.isArray(arr)) throw 0;
      if (confirm(`Adicionar ${arr.length} lançamentos do arquivo à sua conta?`)) await enviar(arr);
    } catch (e) { aviso('Arquivo inválido ou falha ao enviar.', true); }
  };
  r.readAsText(file);
}

// ========== 6) Eventos ==========
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = { 'f-login': fazerLogin, 'f-reg': fazerCadastro, 'f-forgot': esqueci, 'f-rec': novaSenha, 'chpw': trocarSenha }[e.target.id];
  if (f) acao(e.submitter || e.target.querySelector('button'), f);
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; $('#lst').innerHTML = listaHtml(); } });
document.addEventListener('change', e => { if (e.target.id === 'file' && e.target.files[0]) importar(e.target.files[0]); });
document.addEventListener('click', e => {
  const g = s => e.target.closest(s); let el;
  if (e.target.id === 'ov') return fechar();
  if (el = g('[data-modo]')) { S.modo = el.dataset.modo; S.reset = false; render(); }
  else if (el = g('nav button')) { S.tab = el.dataset.t; render(); scrollTo(0, 0); }
  else if (el = g('[data-n]')) { S.m += +el.dataset.n; if (S.m < 0) { S.m = 11; S.y--; } if (S.m > 11) { S.m = 0; S.y++; } render(); }
  else if (el = g('[data-f]')) { S.flt = el.dataset.f; render(); }
  else if (el = g('[data-th]')) { try { localStorage.setItem(K.theme, el.dataset.th); } catch (x) { } render(); }
  else if (el = g('[data-ty]')) tipo(el.dataset.ty);
  else if (el = g('.row')) abrirFolha(el.dataset.id);
  else if (el = g('[data-act]')) {
    const a = el.dataset.act;
    if (a === 'new') abrirFolha();
    else if (a === 'close') fechar();
    else if (a === 'save') acao(el, salvarLancamento);
    else if (a === 'del') { if (confirm('Excluir este lançamento?')) acao(el, excluir); }
    else if (a === 'exp') exportar();
    else if (a === 'imp') $('#file').click();
    else if (a === 'logout') sb.auth.signOut();
    else if (a === 'wipe') { if (confirm('Apagar TODOS os lançamentos da sua conta? Não dá para desfazer.')) acao(el, apagarTudo); }
    else if (a === 'legacy') acao(el, async () => { await enviar(antigos()); try { localStorage.removeItem(K.legacy); } catch (x) { } render(); });
  }
});

iniciar();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
