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

  // 5500 -> "5.500"
  const n = (x) => C().numero(x);
  const reais = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function dataCurta(ms) {
    const d = new Date(ms);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // ---------- pedaços do painel ----------

  function cartaoProducao(p) {
    const ant = p.anterior;
    const comparar = ant.n ? `${ant.n} ${ant.n === 1 ? 'mistura' : 'misturas'} · ${n(ant.kg)} kg nos 7 dias antes` : 'Nada nos 7 dias antes';
    return `
  <section class="secao" aria-labelledby="t-producao">
    <h2 id="t-producao">Produção</h2>
    <div class="grade-2 numeros-terra">
      <div class="numero-grande"><span class="valor">${p.n}</span><span class="legenda">${p.n === 1 ? 'mistura' : 'misturas'}</span></div>
      <div class="numero-grande"><span class="valor">${n(p.kg)}</span><span class="legenda">kg de sal feitos</span></div>
    </div>
    ${p.porFormula.length ? `<ul class="lista">${p.porFormula.map((f) => `
      <li class="linha-dupla"><span>${esc(f.nome)}</span><b>${f.n} × · ${n(f.kg)} kg</b></li>`).join('')}</ul>` : '<p>Nenhuma mistura nesses 7 dias.</p>'}
    <p class="ajuda">${comparar}</p>
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
        <span class="detalhe">Previsto: ${n(x.previstoKg)} kg (${esc(C().qtdTexto(x.previstoKg, ins))})${x.contado ? ` · Real: ${n(x.realKg)} kg` : ''}</span>
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
        <span class="detalhe">Tem ${esc(C().qtdTexto(ins.estoqueKg, ins))}${ins.estoqueMinimoKg ? ` · mínimo ${esc(C().qtdTexto(ins.estoqueMinimoKg, ins))}` : ''}</span>
        <div class="barra" aria-hidden="true"><span class="${nv}" style="width:${Math.round(largura)}%"></span></div>
      </li>`;
    };
    return `
  <section class="secao" aria-labelledby="t-estoque">
    <h2 id="t-estoque">Estoque em dias</h2>
    <p class="ajuda">Pelo consumo médio dos últimos 14 dias. Vermelho: menos de 3 dias. Laranja: menos de 7 dias ou abaixo do mínimo.</p>
    ${lista.length ? `<ul class="lista">${lista.map(linha).join('')}</ul>` : '<p>Nenhum insumo cadastrado.</p>'}
  </section>`;
  }

  function cartaoConsumo(lista, kgDeposito, dias) {
    const linha = ({ pasto: p, kg, gramas }) => {
      let direita;
      if (gramas !== null) direita = `<span class="g-cabeca"><b>${n(gramas)} g</b><small>por cabeça/dia</small></span>`;
      else if (!(p.cabecas > 0)) direita = `<span class="g-cabeca"><small>falta o número<br>de cabeças</small></span>`;
      else direita = `<span class="g-cabeca"><small>nada enviado</small></span>`;
      return `
      <li class="item-pasto">
        <span class="num-pasto" style="background:${esc(p.cor || '#4a4636')}">${esc(p.numero ?? '')}</span>
        <span class="item-texto"><b>${esc(p.nome)}</b><small>${p.cabecas || 0} cabeças · ${n(kg)} kg enviados</small></span>
        ${direita}
      </li>`;
    };
    return `
  <section class="secao" aria-labelledby="t-consumo">
    <h2 id="t-consumo">Consumo por cabeça por dia</h2>
    <p class="ajuda">Sal mandado para o pasto ÷ cabeças ÷ ${dias} ${dias === 1 ? 'dia' : 'dias'}.</p>
    ${lista.length ? `<ul class="lista">${lista.map(linha).join('')}</ul>` : '<p>Nenhum pasto cadastrado.</p>'}
    ${kgDeposito ? `<p class="ajuda">Foram para o depósito: ${n(kgDeposito)} kg (não entram na conta).</p>` : ''}
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
        <div class="linha-dupla"><b>${esc(c.insumo.nome)}</b><b class="qtd-compra">${esc(C().qtdTexto(c.kg, c.insumo))}</b></div>
        <span class="detalhe">${n(c.kg)} kg${c.custo !== null ? ' · ' + reais(c.custo) : ' · sem preço cadastrado'}</span>
      </li>`).join('')}
    </ul>
    ${comPreco.length ? `<div class="linha-dupla total-compra"><span>Total estimado${semPreco ? ' (só os com preço)' : ''}</span><b>${reais(total)}</b></div>` : ''}`
    : `<p>${selo('verde', 'NADA PARA COMPRAR')}</p>`}
    <p class="ajuda">Para ${C().DIAS_COMPRA} dias de produção, mais o estoque mínimo, menos o que já tem.</p>
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
  </section>`;
  }

  // ---------- telas ----------

  Object.assign(A.telas, {
    async painel({ rolar }) {
      const [misturas, insumos, pastos, problemas, contagens] = await Promise.all(
        ['misturas', 'insumos', 'pastos', 'problemas', 'contagens'].map((x) => A.db.todos(x)));
      const d = C().painel({ misturas, insumos, pastos, problemas, contagens });
      const abertos = d.problemasAbertos;
      const urgentes = d.estoque.filter((e) => e.nivel === 'vermelho');
      const falas = [`Painel dos últimos 7 dias. ${d.producao.n} misturas, ${n(d.producao.kg)} quilos de sal.`];
      if (abertos.length) falas.push(`${abertos.length} ${abertos.length === 1 ? 'problema aberto' : 'problemas abertos'}.`);
      urgentes.forEach((e) => falas.push(`${e.insumo.nome}: ${e.dias === null ? 'estoque acabando' : 'acaba em ' + e.dias + (e.dias === 1 ? ' dia' : ' dias')}.`));
      return {
        fala: falas.join(' '),
        html: `
<main class="tela painel">
  <div class="topo">${U().btnVoltar()}
    <div class="titulo titulo-painel"><img src="icones/icone.svg" alt="" width="40" height="40">
      <span><h1>Painel</h1><small>Últimos 7 dias · ${dataCurta(d.inicio)} a ${dataCurta(d.agora)}</small></span></div>
    ${U().btnFalar()}</div>
  ${abertos.length ? `<button class="alerta vermelho alerta-botao" data-acao="ver-problemas">${ic('problema', 40, 2.4)}<div>
    <b>${abertos.length} ${abertos.length === 1 ? 'problema aberto' : 'problemas abertos'}</b><span>Toque para ver</span></div></button>` : ''}
  ${cartaoProducao(d.producao)}
  ${cartaoPrevistoReal(d.previstoReal)}
  ${cartaoEstoque(d.estoque)}
  ${cartaoConsumo(d.consumoPastos, d.kgDeposito, d.dias)}
  ${cartaoCompras(d.compras)}
  ${cartaoProblemas(abertos)}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=contar]', () => A.ir('contarEstoque'));
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

    // CONTAR ESTOQUE: o dono escreve o que contou; a diferença entra no previsto x real
    async contarEstoque() {
      const insumos = (await A.db.todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const emUnidades = (ins, kg) => { const { kgPor } = C().unidade(ins); return kgPor ? kg / kgPor : kg; };
      const nomeVarios = (ins) => C().unidade(ins).varios;
      return {
        fala: 'Contar estoque. Conte o que tem na fábrica e escreva. Deixe em branco o que não contou.',
        html: `
<main class="tela">
  ${topo('CONTAR ESTOQUE')}
  <p class="instrucao">Conte o que tem na fábrica e escreva. Deixe em branco o que não contou.</p>
  ${insumos.map((i) => `
  <div class="secao contagem">
    <label class="rotulo" for="c-${esc(i.id)}">${esc(i.nome)}</label>
    <p class="ajuda">O app calcula: ${esc(C().qtdTexto(i.estoqueKg, i))} (${n(i.estoqueKg)} kg)</p>
    <div class="campo-linha">
      <input id="c-${esc(i.id)}" data-id="${esc(i.id)}" class="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="Contei…">
      <span class="sufixo">${esc(nomeVarios(i))}</span>
    </div>
    <p class="ajuda" data-ajuda="${esc(i.id)}"></p>
  </div>`).join('') || '<p class="vazio">Nenhum insumo cadastrado.</p>'}
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span></span></p>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
</main>`,
        ligar(r) {
          const porId = U().porId(insumos);
          const paraKg = (ins, v) => { const { kgPor } = C().unidade(ins); return Math.round((kgPor ? v * kgPor : v) * 10) / 10; };
          r.querySelectorAll('input[data-id]').forEach((campo) => {
            campo.addEventListener('input', () => {
              const ins = porId[campo.dataset.id];
              const v = U().lerNumero(campo.value);
              const ajuda = r.querySelector(`[data-ajuda="${campo.dataset.id}"]`);
              if (v === null || v < 0) { ajuda.textContent = ''; return; }
              const kg = paraKg(ins, v);
              const dif = Math.round((ins.estoqueKg - kg) * 10) / 10;
              const texto = Math.abs(dif) < 0.05 ? 'bate com o calculado'
                : dif > 0 ? `faltam ${C().qtdTexto(dif, ins)} do calculado` : `sobram ${C().qtdTexto(-dif, ins)} do calculado`;
              ajuda.textContent = `= ${n(kg)} kg · ${texto}`;
            });
          });
          U().ao(r, '[data-acao=voltar]', () => A.ir('painel'));
          U().ao(r, '[data-acao=salvar]', async (b) => {
            const erro = r.querySelector('.erro');
            const contados = [];
            for (const campo of r.querySelectorAll('input[data-id]')) {
              if (!campo.value.trim()) continue;
              const v = U().lerNumero(campo.value);
              const ins = porId[campo.dataset.id];
              if (v === null || v < 0) {
                erro.querySelector('span').textContent = `Confira o número de ${ins.nome}.`;
                erro.hidden = false;
                campo.focus();
                return;
              }
              contados.push({ ins, kg: paraKg(ins, v) });
            }
            if (!contados.length) {
              erro.querySelector('span').textContent = 'Escreva pelo menos um número.';
              erro.hidden = false;
              return;
            }
            b.disabled = true;
            const quando = new Date().toISOString();
            // Guarda a contagem mesmo quando bate: assim o painel sabe que foi contado
            await A.db.transacao(['insumos', 'contagens'], (l) => contados.forEach(({ ins, kg }) => {
              l('contagens').put({
                id: A.db.novoId('contagem'), insumoId: ins.id, insumoNome: ins.nome,
                antesKg: ins.estoqueKg, depoisKg: kg, quando, tipo: 'contagem', exemplo: false,
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
