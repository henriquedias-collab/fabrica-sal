// Painel dos donos (últimos 7 dias) e a tela de contar o estoque.
// As contas ficam em calculos.js (App.calc.painel); aqui só a tela.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);

  // Ícone e texto que acompanham cada cor (cor nunca é o único sinal)
  const ICONE_NIVEL = { verde: 'certo', laranja: 'atencao', vermelho: 'problema', sem: 'menos' };

  function topo(titulo) {
    return `<div class="topo">${U().btnVoltar()}<h1 class="titulo">${titulo}</h1>${U().btnFalar()}</div>`;
  }

  function selo(nivel, texto) {
    return `<span class="selo ${nivel}">${ic(ICONE_NIVEL[nivel], 18, 2.8)}${texto}</span>`;
  }

  // Números: valor em negrito e unidade mais leve (ajudantes em telas.js)
  const n = (x) => C().numero(x);
  const kgQ = (kg) => U().kgQ(kg);
  const qtdQ = (kg, ins) => U().qtdQ(kg, ins);
  const reaisQ = (v, sufixo, casas) => U().reaisQ(v, sufixo, casas);

  function dataCurta(ms) {
    const d = new Date(ms);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // ---------- pedaços do painel ----------

  // Botões de PDF de uma parte do painel (consumo, compras, problemas): enviar no WhatsApp ou baixar
  function botoesParte(parte) {
    return `<div class="botoes-pdf"><button class="btn-pequeno largo" data-pdf="${parte}" data-modo="whats">${ic('whats', 22, 2.2)} WHATSAPP</button>
    <button class="btn-pequeno largo" data-pdf="${parte}" data-modo="baixar">${ic('baixar', 22, 2.4)} PDF</button></div>`;
  }

  function cartaoProducao(p) {
    const ant = p.anterior;
    const comparar = ant.n ? `${U().q(ant.n, ant.n === 1 ? 'mistura' : 'misturas')} · ${kgQ(ant.kg)} nos 7 dias antes` : 'Nada nos 7 dias antes';
    return `
  <section class="secao" aria-labelledby="t-producao">
    <h2 id="t-producao">Produção</h2>
    <div class="grade-2 numeros-terra">
      <div class="numero-grande"><span class="valor">${p.n}</span><span class="legenda">${p.n === 1 ? 'mistura' : 'misturas'}</span></div>
      <div class="numero-grande"><span class="valor">${n(p.kg)}<small> kg</small></span><span class="legenda">de sal feitos</span></div>
    </div>
    ${p.porFormula.length ? `<ul class="lista">${p.porFormula.map((f) => `
      <li class="linha-dupla"><span>${esc(f.nome)}</span><span>${U().q(f.n, '×')} · ${kgQ(f.kg)}</span></li>`).join('')}</ul>` : '<p>Nenhuma mistura nesses 7 dias.</p>'}
    <p class="ajuda">${comparar}</p>
  </section>`;
  }

  // CUSTO: insumos usados na semana e, por fórmula, custo da batida, R$/kg e comparação com o sal pronto
  function cartaoCusto(c) {
    const semPreco = (nomes) => `<span class="selo sem">${ic('menos', 18, 2.8)}SEM PREÇO</span> <span class="detalhe">${esc(nomes.join(', '))}</span>`;
    const linha = (x) => `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(x.formula.nome)}</b>${x.porKg !== null ? reaisQ(x.porKg, '/kg') : ''}</div>
        ${x.porKg === null ? `<span>${semPreco(x.semPreco)}</span>`
          : `<span class="detalhe">Batida de ${kgQ(x.tamanhoKg)}: ${reaisQ(x.batida)}</span>`}
        ${x.prontoKg !== null ? `<span class="detalhe">Fabricando: ${x.porKg !== null ? reaisQ(x.porKg, '/kg') : 'sem preço'} · Pronto: ${reaisQ(x.prontoKg, '/kg')}</span>
        ${x.economiaMes !== null ? `<span class="detalhe">${x.economiaMes >= 0 ? 'Economia' : 'Gasto a mais'} no mês (${kgQ(x.kg30)} feitos em 30 dias): <b class="${x.economiaMes >= 0 ? 'positivo' : 'negativo'}">${reaisQ(Math.abs(x.economiaMes), '', 0)}</b></span>` : ''}` : ''}
      </li>`;
    return `
  <section class="secao" aria-labelledby="t-custo">
    <h2 id="t-custo">Custo</h2>
    <p class="ajuda">Só os insumos, pelos preços de hoje do cadastro (sem frete, mão de obra nem perdas).</p>
    <div class="linha-dupla custo-semana"><span>Insumos usados nos 7 dias</span>${c.semana !== null ? `<b>${reaisQ(c.semana, '', 0)}</b>` : semPreco(c.semPrecoSemana)}</div>
    ${c.formulas.length ? `<ul class="lista">${c.formulas.map(linha).join('')}</ul>` : '<p>Nenhuma mistura nos últimos 30 dias.</p>'}
    <button class="btn" data-acao="precos">${ic('saco', 30, 2)} ATUALIZAR PREÇOS</button>
  </section>`;
  }

  function cartaoPrevistoReal(lista) {
    const linha = (x) => {
      const ins = x.insumo;
      let resultado;
      if (x.nivel === 'sem') resultado = selo('sem', 'SEM CONTAGEM');
      else if (x.nivel === 'verde') resultado = selo('verde', 'BATEU');
      else if (x.difKg > 0) resultado = selo(x.nivel, 'SUMIU ' + esc(C().qtdTexto(x.difKg, ins)));
      else resultado = selo(x.nivel, 'SOBROU ' + esc(C().qtdTexto(-x.difKg, ins)));
      return `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(ins.nome)}</b>${resultado}</div>
        <span class="detalhe">Previsto: ${kgQ(x.previstoKg)} (${qtdQ(x.previstoKg, ins)})${x.contado ? ` · Real: ${kgQ(x.realKg)}` : ''}</span>
      </li>`;
    };
    const algumSem = lista.some((x) => x.nivel === 'sem');
    return `
  <section class="secao" aria-labelledby="t-prevreal">
    <h2 id="t-prevreal">Previsto x real</h2>
    <p class="ajuda">Previsto = o que as misturas registraram, saco por saco (mistura incompleta conta só o que foi colocado). Real = previsto + a diferença achada ao contar o estoque.</p>
    ${lista.length ? `<ul class="lista">${lista.map(linha).join('')}</ul>` : '<p>Nenhuma mistura nem contagem nesses 7 dias.</p>'}
    ${algumSem ? '<p class="ajuda">Para comparar, conte o estoque pelo menos uma vez por semana.</p>' : ''}
    <button class="btn" data-acao="contar">${ic('saco', 30, 2)} CONTAR ESTOQUE</button>
  </section>`;
  }

  function cartaoEstoque(lista) {
    const linha = ({ insumo: ins, dias, nivel }) => {
      const nv = nivel || 'verde';
      const texto = dias === null
        ? (nivel ? (ins.estoqueKg <= 0 ? 'acabou' : 'abaixo do mínimo') : 'sem uso recente')
        : (dias === 0 ? 'acaba hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`);
      const largura = dias === null ? (nivel ? 8 : 100) : Math.max(4, Math.min(100, (dias / C().DIAS_COMPRA) * 100));
      return `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(ins.nome)}</b>${selo(nv, esc(texto.toUpperCase()))}</div>
        <span class="detalhe">Tem ${qtdQ(ins.estoqueKg, ins)}${ins.estoqueMinimoKg ? ` · mínimo ${qtdQ(ins.estoqueMinimoKg, ins)}` : ''}</span>
        <div class="barra" aria-hidden="true"><span class="${nv}" style="width:${Math.round(largura)}%"></span></div>
      </li>`;
    };
    return `
  <section class="secao" aria-labelledby="t-estoque">
    <h2 id="t-estoque">Estoque em dias</h2>
    <p class="ajuda">Pelo consumo médio dos últimos 14 dias. Vermelho: menos de 3 dias. Amarelo: menos de 7 dias ou abaixo do mínimo.</p>
    ${lista.length ? `<ul class="lista">${lista.map(linha).join('')}</ul>` : '<p>Nenhum insumo cadastrado.</p>'}
  </section>`;
  }

  // CONSUMO POR CABEÇA: g/cabeça/dia, meta do técnico (por época) e custo por cabeça por dia
  function cartaoConsumo(lista, kgDeposito, dias, ep) {
    const seloMeta = { dentro: () => selo('verde', 'DENTRO DA META'), acima: () => selo('laranja', 'ACIMA DA META'), abaixo: () => selo('laranja', 'ABAIXO DA META') };
    const linha = (x) => {
      const p = x.pasto;
      let direita;
      if (x.gramas !== null) direita = `<span class="g-cabeca"><span class="q"><b>${n(x.gramas)}</b> <small>g</small></span><small>por cabeça/dia</small></span>`;
      else if (!(p.cabecas > 0)) direita = `<span class="g-cabeca"><small>falta o número<br>de cabeças</small></span>`;
      else direita = `<span class="g-cabeca"><small>nada enviado</small></span>`;
      const extras = [];
      if (x.meta) extras.push(`Meta ${ep ? 'da ' + ep.nome.toLowerCase() : ''}: ${U().q(n(x.meta), 'g')}`);
      if (x.custoCabDia !== null) extras.push(`${reaisQ(x.custoCabDia, '/cabeça/dia', 3)}`);
      else if (x.semPreco) extras.push('custo: sem preço');
      return `
      <li class="item-pasto-col">
        <div class="item-pasto">
          <span class="num-pasto" style="background:${esc(p.cor || '#4a4636')}">${esc(p.numero ?? '')}</span>
          <span class="item-texto"><b>${esc(p.nome)}</b><small>${U().q(p.cabecas || 0, 'cabeças')} · ${kgQ(x.kg)} enviados</small></span>
          ${direita}
        </div>
        ${extras.length || x.nivelMeta ? `<div class="linha-dupla extras-pasto"><span class="detalhe">${extras.join(' · ')}</span>${x.nivelMeta ? seloMeta[x.nivelMeta]() : ''}</div>` : ''}
      </li>`;
    };
    return `
  <section class="secao" aria-labelledby="t-consumo">
    <h2 id="t-consumo">Consumo por cabeça por dia</h2>
    <p class="ajuda">Sal mandado para o pasto ÷ cabeças ÷ ${dias} ${dias === 1 ? 'dia' : 'dias'}. A meta é a do técnico, cadastrada no lote${ep ? ` (época marcada: ${ep.nome.toLowerCase()})` : ''}; até 10% de diferença conta como dentro.</p>
    ${lista.length ? `<ul class="lista">${lista.map(linha).join('')}</ul>` : '<p>Nenhum pasto cadastrado.</p>'}
    ${kgDeposito ? `<p class="ajuda">Foram para o depósito: ${kgQ(kgDeposito)} (não entram na conta).</p>` : ''}
    ${botoesParte('consumo')}
  </section>`;
  }

  function cartaoCompras(lista) {
    const comPreco = lista.filter((c) => c.custo !== null);
    const total = comPreco.reduce((s, c) => s + c.custo, 0);
    const semPreco = lista.length - comPreco.length;
    return `
  <section class="secao" aria-labelledby="t-compras">
    <h2 id="t-compras">Lista de compras sugerida</h2>
    ${lista.length ? `
    <ul class="lista">${lista.map((c) => `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(c.insumo.nome)}</b><span class="qtd-compra">${qtdQ(c.kg, c.insumo)}</span></div>
        <span class="detalhe">${kgQ(c.kg)}${c.custo !== null ? ' · ' + reaisQ(c.custo) : ' · sem preço cadastrado'}</span>
      </li>`).join('')}
    </ul>
    ${comPreco.length ? `<div class="linha-dupla total-compra"><span>Total estimado${semPreco ? ' (só os com preço)' : ''}</span>${reaisQ(total)}</div>` : ''}`
    : `<p>${selo('verde', 'NADA PARA COMPRAR')}</p>`}
    <p class="ajuda">Para ${C().DIAS_COMPRA} dias de produção, mais o estoque mínimo, menos o que já tem.</p>
    ${botoesParte('compras')}
  </section>`;
  }

  function cartaoProblemas(lista) {
    return `
  <section class="secao" id="problemas" aria-labelledby="t-problemas">
    <h2 id="t-problemas">Problemas abertos: ${lista.length}</h2>
    ${lista.length ? lista.map((p) => `
    <div class="problema-aberto">
      <div class="linha-dupla"><b>${esc(U().descreverProblema(p))}</b>${selo('vermelho', 'ABERTO')}</div>
      <span class="detalhe">${esc(C().quando(p.quando))} · ${esc(p.pessoaNome || '—')}${p.exemplo ? ' <span class="etiqueta">exemplo</span>' : ''}</span>
      ${p.foto ? `<img class="foto-registro" src="${p.foto}" alt="Foto do problema">` : ''}
      ${p.audio ? `<audio controls preload="none" data-audio="${esc(p.id)}"></audio>` : ''}
      <button class="btn" data-resolver="${esc(p.id)}">${ic('certo', 30, 3)} RESOLVIDO</button>
    </div>`).join('') : `<p>${selo('verde', 'NENHUM PROBLEMA ABERTO')}</p>`}
    ${lista.length ? botoesParte('problemas') : ''}
  </section>`;
  }

  // ---------- telas ----------

  Object.assign(A.telas, {
    async painel({ rolar }) {
      const [misturas, insumos, pastos, problemas, contagens, formulas] = await Promise.all(
        ['misturas', 'insumos', 'pastos', 'problemas', 'contagens', 'formulas'].map((x) => A.db.todos(x)));
      // Época marcada (usada na meta de cada lote) e aviso de troca (só no mês marcado; o app nunca troca sozinho)
      const [epoca, meses, nomeFazenda] = await Promise.all([A.db.config('epocaAtual'), A.db.config('mesesEpoca'), A.db.config('nomeFazenda')]);
      const d = C().painel({ misturas, insumos, pastos, problemas, contagens, formulas, epoca });
      const abertos = d.problemasAbertos;
      const urgentes = d.estoque.filter((e) => e.nivel === 'vermelho');
      const ep = epoca ? C().EPOCAS[epoca] : null;
      const troca = C().avisoTrocaEpoca(epoca, meses);
      const semPreco = (await A.gasto.comprasSemPreco()).length;
      const falas = [`Painel dos últimos 7 dias. ${d.producao.n} misturas, ${n(d.producao.kg)} quilos de sal.`];
      if (troca) falas.push(`Atenção: hora de trocar para o sal ${C().EPOCAS[troca.para].fala}.`);
      if (semPreco) falas.push(`${semPreco} ${semPreco === 1 ? 'chegada sem preço pago' : 'chegadas sem preço pago'}.`);
      if (abertos.length) falas.push(`${abertos.length} ${abertos.length === 1 ? 'problema aberto' : 'problemas abertos'}.`);
      urgentes.forEach((e) => falas.push(`${e.insumo.nome}: ${e.dias === null ? 'estoque acabando' : 'acaba em ' + e.dias + (e.dias === 1 ? ' dia' : ' dias')}.`));
      return {
        fala: falas.join(' '),
        html: `
<main class="tela painel">
  <div class="topo">${U().btnVoltar()}
    <div class="titulo titulo-painel"><img src="icones/icone.svg" alt="" width="40" height="40">
      <span><h1>Painel</h1><small>Últimos 7 dias · ${dataCurta(d.inicio)} a ${dataCurta(d.agora)}${ep ? ` · Época: ${ep.nome}` : ''}</small></span></div>
    ${U().btnFalar()}</div>
  ${troca ? `<button class="alerta laranja alerta-botao alerta-troca" data-acao="ver-epoca">${ic('atencao', 40, 2.4)}<div>
    <b>Hora de trocar para o sal ${C().EPOCAS[troca.para].fala}</b><span>Pelo mês marcado. Toque para marcar a época quando trocar.</span></div></button>` : ''}
  ${semPreco ? `<button class="alerta laranja alerta-preco" data-acao="ver-sem-preco">${ic('atencao', 40, 2.4)}<div>
    <b>${semPreco} ${semPreco === 1 ? 'chegada sem preço pago' : 'chegadas sem preço pago'}</b><span>Toque para informar quanto pagou: o gasto fica exato.</span></div></button>` : ''}
  ${abertos.length ? `<button class="alerta vermelho alerta-botao" data-acao="ver-problemas">${ic('problema', 40, 2.4)}<div>
    <b>${abertos.length} ${abertos.length === 1 ? 'problema aberto' : 'problemas abertos'}</b><span>Toque para ver</span></div></button>` : ''}
  ${cartaoProducao(d.producao)}
  ${cartaoCusto(d.custo)}
  ${cartaoPrevistoReal(d.previstoReal)}
  ${cartaoEstoque(d.estoque)}
  ${cartaoConsumo(d.consumoPastos, d.kgDeposito, d.dias, ep)}
  ${cartaoCompras(d.compras)}
  ${cartaoProblemas(abertos)}
  <button class="btn verde grande" data-pdf="painel" data-modo="whats">${ic('whats', 44, 2.2)} ENVIAR NO WHATSAPP</button>
  <button class="btn" data-pdf="painel" data-modo="baixar">${ic('baixar', 32, 2.4)} PDF DO PAINEL</button>
  <p class="ajuda centro">O painel inteiro em PDF. Consumo, compras e problemas também têm PDF só deles.</p>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=contar]', () => A.ir('contarEstoque'));
          U().ao(r, '[data-acao=ver-sem-preco]', () => A.ir('comprasSemPreco', { volta: 'painel' }));
          A.pdf.carregar().catch(() => {}); // deixa o gerador de PDF pronto (o celular só compartilha logo depois do toque)
          U().ao(r, '[data-pdf]', async (b) => {
            b.disabled = true;
            await A.pdf.entregar(() => A.pdfRelatorios.painel(d, { parte: b.dataset.pdf, nomeFazenda, epoca }), b.dataset.modo);
            b.disabled = false;
          });
          U().ao(r, '[data-acao=ver-epoca]', () => A.ir('epoca'));
          U().ao(r, '[data-acao=precos]', () => A.ir('precos', { volta: 'painel' }));
          U().ao(r, '[data-acao=ver-problemas]', () => r.querySelector('#problemas').scrollIntoView({ behavior: 'smooth' }));
          r.querySelectorAll('[data-audio]').forEach((el) => {
            const p = problemas.find((x) => x.id === el.dataset.audio);
            if (p && p.audio instanceof Blob) el.src = URL.createObjectURL(p.audio);
          });
          U().ao(r, '[data-resolver]', async (b) => {
            b.disabled = true;
            const p = await A.db.pegar('problemas', b.dataset.resolver);
            if (p) await A.db.salvar('problemas', Object.assign(p, { resolvidoEm: new Date().toISOString() }));
            await A.ir('painel', { rolar: 'problemas' });
            A.mostrarAviso('Problema marcado como resolvido');
          });
          if (rolar) setTimeout(() => { const el = r.querySelector('#' + rolar); if (el) el.scrollIntoView(); }, 0);
        },
      };
    },

    // CONTAR ESTOQUE: o dono escreve o que contou; a diferença entra no previsto x real.
    // Cada insumo pode ter várias linhas (ex.: 10 sacos de 25 kg + 4 de 50 kg) ou ser contado em kg.
    async contarEstoque() {
      const insumos = (await A.db.todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const porId = U().porId(insumos);
      // linhas[id] = [{ qtd: texto digitado, peso: kg do saco ou 'kg' (contado em kg) }]
      const linhas = {};
      insumos.forEach((i) => { const u = C().unidade(i); linhas[i.id] = [{ qtd: '', peso: u.kgPor || 'kg' }]; });
      const pesosDe = (ins) => {
        const u = C().unidade(ins);
        const extras = linhas[ins.id].map((l) => l.peso).filter((p) => p !== 'kg');
        return [...new Set([...(C().PESOS_COMUNS[ins.unidade || 'saco'] || []), u.kgPor, ...extras].filter((x) => x > 0))].sort((a, b) => a - b);
      };
      const kgDaLinha = (l) => {
        const v = U().lerNumero(l.qtd);
        if (v === null || v < 0) return null;
        return Math.round((l.peso === 'kg' ? v : v * l.peso) * 10) / 10;
      };
      const linhaHtml = (ins, l, k) => {
        const u = C().unidade(ins);
        const chips = u.granel ? '' : pesosDe(ins).map((p) => {
          const sel = l.peso !== 'kg' && Math.abs(p - l.peso) < 0.05;
          return `<button class="opcao peso" data-linha="${k}" data-peso="${p}" aria-pressed="${sel}">${sel ? ic('certo', 16, 3.4) : ''}${n(p)} kg</button>`;
        }).join('') + `<button class="opcao peso" data-linha="${k}" data-peso="kg" aria-pressed="${l.peso === 'kg'}">${l.peso === 'kg' ? ic('certo', 16, 3.4) : ''}EM KG</button>`;
        const sufixo = l.peso === 'kg' ? 'kg' : C().nomeUnidade(2, ins);
        return `
      <div class="linha-contagem">
        <div class="campo-linha">
          <input class="campo" type="text" inputmode="decimal" autocomplete="off" data-linha="${k}" value="${esc(l.qtd)}" placeholder="Contei…" aria-label="Quantidade contada de ${esc(ins.nome)}">
          <span class="sufixo">${esc(sufixo)}</span>
          ${linhas[ins.id].length > 1 ? `<button class="btn-pequeno ruim" data-tirar-linha="${k}" aria-label="Tirar esta linha">${ic('mais', 22, 2.6)}</button>` : ''}
        </div>
        ${u.granel ? '' : `<div class="pesos">${chips}</div>`}
      </div>`;
      };
      const blocoHtml = (ins) => {
        const u = C().unidade(ins);
        return `
    <label class="rotulo">${esc(ins.nome)}</label>
    <p class="ajuda">O app calcula: ${U().qtdQ(ins.estoqueKg, ins)} (${U().kgQ(ins.estoqueKg)})${u.kgPor ? ` · ${esc(u.um)} atual: ${U().kgQ(u.kgPor)}` : ''}</p>
    ${linhas[ins.id].map((l, k) => linhaHtml(ins, l, k)).join('')}
    ${u.granel ? '' : `<button class="btn btn-mais-tamanho" data-mais-linha>${ic('mais', 26, 2.6)} OUTRO TAMANHO</button>`}
    <p class="resultado-contagem" data-resultado aria-live="polite"></p>`;
      };
      return {
        fala: 'Contar estoque. Para cada insumo, escreva quantos sacos contou e toque no peso do saco. Se tem sacos de tamanhos diferentes, toque em outro tamanho. Deixe em branco o que não contou.',
        html: `
<main class="tela">
  ${topo('CONTAR ESTOQUE')}
  <p class="instrucao">Conte o que tem na fábrica e escreva. Deixe em branco o que não contou.</p>
  ${insumos.map((i) => `<div class="secao contagem" data-bloco="${esc(i.id)}">${blocoHtml(i)}</div>`).join('') || '<p class="vazio">Nenhum insumo cadastrado.</p>'}
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span></span></p>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
</main>`,
        ligar(r) {
          const bloco = (id) => r.querySelector(`[data-bloco="${CSS.escape(id)}"]`);
          // Soma das linhas preenchidas (null = nada contado; NaN = número errado)
          const totalKg = (id) => {
            const preenchidas = linhas[id].filter((l) => l.qtd.trim() !== '');
            if (!preenchidas.length) return null;
            let soma = 0;
            for (const l of preenchidas) { const kg = kgDaLinha(l); if (kg === null) return NaN; soma += kg; }
            return Math.round(soma * 10) / 10;
          };
          const mostrarResultado = (id) => {
            const ins = porId[id];
            const caixa = bloco(id).querySelector('[data-resultado]');
            const kg = totalKg(id);
            if (kg === null) { caixa.innerHTML = ''; return; }
            if (Number.isNaN(kg)) { caixa.innerHTML = '<span class="etiqueta ruim">confira o número</span>'; return; }
            const dif = Math.round((ins.estoqueKg - kg) * 10) / 10;
            const emSacos = (x) => (C().unidade(ins).kgPor ? ` <span class="detalhe">(${U().qtdQ(x, ins)} de ${n(C().unidade(ins).kgPor)} kg)</span>` : '');
            caixa.innerHTML = `Contado: <b>${U().kgQ(kg)}</b> · ` + (Math.abs(dif) < 0.05
              ? `<span class="selo verde">${ic('certo', 16, 3)}BATE COM O CALCULADO</span>`
              : dif > 0
                ? `<span class="selo laranja">${ic('atencao', 16, 2.6)}FALTAM ${n(dif)} KG</span>${emSacos(dif)}`
                : `<span class="selo laranja">${ic('atencao', 16, 2.6)}SOBRAM ${n(-dif)} KG</span>${emSacos(-dif)}`);
          };
          const redesenhar = (id) => { bloco(id).innerHTML = blocoHtml(porId[id]); mostrarResultado(id); };

          r.addEventListener('input', (ev) => {
            const campo = ev.target.closest('input[data-linha]');
            if (!campo) return;
            const id = campo.closest('[data-bloco]').dataset.bloco;
            linhas[id][Number(campo.dataset.linha)].qtd = campo.value;
            mostrarResultado(id);
          });
          r.addEventListener('click', (ev) => {
            const b = ev.target.closest('button');
            if (!b || !b.closest('[data-bloco]')) return;
            const id = b.closest('[data-bloco]').dataset.bloco;
            if (b.dataset.peso !== undefined) {
              linhas[id][Number(b.dataset.linha)].peso = b.dataset.peso === 'kg' ? 'kg' : Number(b.dataset.peso);
              redesenhar(id);
            } else if (b.dataset.maisLinha !== undefined) {
              // Novo tamanho: começa num peso diferente dos que já estão nas linhas
              const usados = linhas[id].map((l) => l.peso);
              const livre = pesosDe(porId[id]).find((p) => !usados.includes(p)) || 'kg';
              linhas[id].push({ qtd: '', peso: livre });
              redesenhar(id);
              const campos = bloco(id).querySelectorAll('input[data-linha]');
              campos[campos.length - 1].focus();
            } else if (b.dataset.tirarLinha !== undefined) {
              linhas[id].splice(Number(b.dataset.tirarLinha), 1);
              redesenhar(id);
            }
          });
          U().ao(r, '[data-acao=voltar]', () => A.ir('painel'));
          U().ao(r, '[data-acao=salvar]', async (b) => {
            const erro = r.querySelector('.erro');
            const contados = [];
            for (const ins of insumos) {
              const kg = totalKg(ins.id);
              if (kg === null) continue;
              if (Number.isNaN(kg)) {
                erro.querySelector('span').textContent = `Confira o número de ${ins.nome}.`;
                erro.hidden = false;
                bloco(ins.id).scrollIntoView({ block: 'center' });
                return;
              }
              const detalhe = linhas[ins.id].filter((l) => l.qtd.trim() !== '')
                .map((l) => (l.peso === 'kg' ? { kg: kgDaLinha(l) } : { quantidade: U().lerNumero(l.qtd), kgPorSaco: l.peso }));
              contados.push({ ins, kg, detalhe });
            }
            if (!contados.length) {
              erro.querySelector('span').textContent = 'Escreva pelo menos um número.';
              erro.hidden = false;
              return;
            }
            b.disabled = true;
            const quando = new Date().toISOString();
            // Guarda a contagem mesmo quando bate: assim o painel sabe que foi contado
            await A.db.transacao(['insumos', 'contagens'], (l) => contados.forEach(({ ins, kg, detalhe }) => {
              l('contagens').put({
                id: A.db.novoId('contagem'), insumoId: ins.id, insumoNome: ins.nome,
                antesKg: ins.estoqueKg, depoisKg: kg, detalhe, quando, tipo: 'contagem', exemplo: false,
              });
              l('insumos').put(Object.assign({}, ins, { estoqueKg: kg }));
            }));
            await A.ir('painel');
            A.mostrarAviso(`Contagem guardada (${contados.length} ${contados.length === 1 ? 'insumo' : 'insumos'})`);
          });
        },
      };
    },
  });
})();
