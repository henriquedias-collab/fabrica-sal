// RESUMO DA SEMANA — a TELA (área do dono). As contas ficam em resumo-calculo.js (puro, sem tela),
// para o mesmo cálculo poder rodar na nuvem no futuro.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);
  const n = (x) => C().numero(x);
  const SEM_DADO = '<span class="sem-dado">sem dado</span>';

  // Lê tudo do banco e calcula o resumo da semana que contém a data "semana"
  async function resumoDaSemana(semana) {
    const [misturas, insumos, pastos, problemas, contagens, epoca, nomeFazenda] = await Promise.all([
      A.db.todos('misturas'), A.db.todos('insumos'), A.db.todos('pastos'), A.db.todos('problemas'), A.db.todos('contagens'),
      A.db.config('epocaAtual'), A.db.config('nomeFazenda'),
    ]);
    return A.resumoCalc.calcular({ misturas, insumos, pastos, problemas, contagens, epoca, nomeFazenda }, { semana });
  }

  const reais = (v, casas) => (v === null || v === undefined ? SEM_DADO : U().reaisQ(v, '', casas === undefined ? 0 : casas));
  const kg = (v) => (v === null || v === undefined ? SEM_DADO : U().kgQ(v));
  const ICONE = { acima: 'atencao', abaixo: 'atencao', normal: 'certo' };
  const NOME_NIVEL = { acima: 'ACIMA', abaixo: 'ABAIXO', normal: 'NORMAL' };
  const COR_NIVEL = { acima: 'laranja', abaixo: 'laranja', normal: 'verde' };

  // Seta e % da comparação com a semana anterior
  function variacao(v, formato) {
    if (v.atual === null || v.atual === undefined || v.anterior === null || v.anterior === undefined) {
      return `<span class="var">${formato(v.atual)} <small>antes: ${formato(v.anterior)}</small></span>`;
    }
    const pct = v.pct === null ? '' : `${v.dif > 0 ? '▲' : v.dif < 0 ? '▼' : '='} ${n(Math.abs(v.pct * 100))}%`;
    return `<span class="var">${formato(v.atual)} <small>antes: ${formato(v.anterior)}${pct ? ` · ${pct}` : ''}</small></span>`;
  }

  Object.assign(A.telas, {
    async resumo({ semana }) {
      const r = await resumoDaSemana(semana);
      const s = r.semana;
      const DIA = A.resumoCalc.DIA;
      const ehUltimaCompleta = r.periodo.inicio === A.resumoCalc.inicioDaSemana(Date.now() - 7 * DIA);
      const podeAvancar = !r.periodo.emAndamento;
      const qual = r.periodo.emAndamento ? `esta semana (até hoje, ${r.periodo.dias} ${r.periodo.dias === 1 ? 'dia' : 'dias'})` : ehUltimaCompleta ? 'semana passada' : 'semana anterior';
      const p = s.perdas;
      const falas = [`Resumo da ${qual}, de ${r.periodo.rotulo}.`];
      falas.push(s.gasto !== null ? `Gasto com insumos: ${n(Math.round(s.gasto))} reais.` : 'Gasto: sem dado, falta preço.');
      falas.push(`${p.quantidade} ${p.quantidade === 1 ? 'problema' : 'problemas'}.`);
      if (s.custoCabDia !== null) falas.push(`Custo por cabeça por dia: ${U().reaisTexto(s.custoCabDia, 2)} reais.`);
      const acima = s.lotes.filter((l) => l.nivel === 'acima').map((l) => l.nome);
      const abaixo = s.lotes.filter((l) => l.nivel === 'abaixo').map((l) => l.nome);
      if (acima.length) falas.push(`Acima da meta: ${acima.join(', ')}.`);
      if (abaixo.length) falas.push(`Abaixo da meta: ${abaixo.join(', ')}.`);
      if (r.estoque.length) falas.push(`Acabando em até 15 dias: ${r.estoque.map((e) => e.nome).join(', ')}.`);

      const linhaProblema = (x) => `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(U().NOMES_PROBLEMA[x.tipo] || 'Problema')}${x.insumoNome ? ': ' + esc(x.insumoNome) : ''}</b>
          ${x.resolvido ? '<span class="selo verde">' + ic('certo', 16, 3) + 'RESOLVIDO</span>' : '<span class="selo vermelho">' + ic('problema', 16, 2.6) + 'ABERTO</span>'}</div>
        <span class="detalhe">${esc(C().quando(x.quando))} · ${esc(x.pessoaNome || '—')}</span>
        ${x.temFoto ? `<img class="foto-registro" data-foto="${esc(x.id)}" alt="Foto do problema">` : ''}
        ${x.podeTerPerda ? `<div class="linha-dupla"><span class="detalhe">Perdido: ${kg(x.kg)} · ${reais(x.reais, 2)}</span>
          <button class="btn-pequeno largo" data-perda="${esc(x.id)}">${x.kg === null ? 'INFORMAR PERDA' : 'MUDAR'}</button></div>` : ''}
      </li>`;
      const linhaSumico = (x) => `
      <li class="item-painel">
        <div class="linha-dupla"><b>Sumiu na contagem: ${esc(x.insumoNome)}</b><span class="selo laranja">${ic('atencao', 16, 2.6)}${n(x.kg)} KG</span></div>
        <span class="detalhe">${esc(C().quando(x.quando))} · ${reais(x.reais, 2)}</span>
      </li>`;
      const linhaLote = (l) => `
      <li class="item-pasto-col">
        <div class="item-pasto">
          <span class="num-pasto" style="background:${esc(l.cor || '#4a4636')}">${esc(l.numero ?? '')}</span>
          <span class="item-texto"><b>${esc(l.nome)}</b><small>${U().q(l.cabecas, 'cabeças')} · ${U().kgQ(l.kg)}</small></span>
          <span class="g-cabeca">${l.gramas !== null ? `<span class="q"><b>${n(l.gramas)}</b> <small>g</small></span><small>por cabeça/dia</small>` : '<small>nada enviado</small>'}</span>
        </div>
        <div class="linha-dupla extras-pasto"><span class="detalhe">Meta: ${l.meta ? U().q(n(l.meta), 'g') : SEM_DADO} · ${l.custoCabDia !== null ? U().reaisQ(l.custoCabDia, '/cabeça/dia', 3) : (l.kg > 0 ? 'custo: ' + SEM_DADO : '')}</span>
          ${l.nivel ? `<span class="selo ${COR_NIVEL[l.nivel]}">${ic(ICONE[l.nivel], 16, 2.8)}${NOME_NIVEL[l.nivel]}</span>` : ''}</div>
      </li>`;
      const linhaEstoque = (e) => `
      <li class="item-painel">
        <div class="linha-dupla"><b>${esc(e.nome)}</b><span class="selo ${e.nivel}">${ic(e.nivel === 'vermelho' ? 'problema' : 'atencao', 16, 2.6)}${e.estoqueKg <= 0 ? 'ACABOU' : e.dias !== null ? `${e.dias} ${e.dias === 1 ? 'DIA' : 'DIAS'}` : 'ABAIXO DO MÍNIMO'}</span></div>
        <span class="detalhe">Tem ${U().kgQ(e.estoqueKg)}${e.comprarUnidades ? ` · comprar ${e.kgSaco ? U().q(e.comprarUnidades, e.comprarUnidades === 1 ? 'saco' : 'sacos') + ` de ${n(e.kgSaco)} kg` : U().kgQ(e.comprarKg)} · ${reais(e.comprarReais)}` : ''}</span>
      </li>`;
      // Total da compra: soma do que tem preço; os sem preço aparecem como "sem dado" ao lado
      const semPrecoCompra = r.estoque.filter((e) => e.comprarUnidades && e.comprarReais === null).map((e) => e.nome);
      const totalCompras = r.estoque.reduce((acc, e) => acc + (e.comprarReais || 0), 0);
      const cmp = r.comparacao;

      return {
        fala: falas.join(' '),
        html: `
<main class="tela painel">
  <div class="topo">${U().btnVoltar()}
    <div class="titulo titulo-painel"><img src="icones/icone.svg" alt="" width="40" height="40">
      <span><h1>Resumo da semana</h1><small>${r.nomeFazenda ? esc(r.nomeFazenda) : 'Cocho'}</small></span></div>
    ${U().btnFalar()}</div>
  <div class="nav-semana">
    <button class="btn-redondo" data-acao="semana-antes" aria-label="Semana anterior">${ic('voltar', 30, 2.6)}</button>
    <div class="nav-rotulo"><b>${esc(r.periodo.rotulo)}</b><small>${esc(qual)}</small></div>
    <button class="btn-redondo seta-frente" data-acao="semana-depois" aria-label="Semana seguinte" ${podeAvancar ? '' : 'disabled'}>${ic('voltar', 30, 2.6)}</button>
  </div>

  <section class="secao" aria-labelledby="t-gasto">
    <h2 id="t-gasto">Gasto da semana</h2>
    <div class="numero-grande destaque-terra"><span class="valor">${s.gasto !== null ? U().reaisQ(s.gasto, '', 0) : 'sem dado'}</span>
      <span class="legenda">${s.gasto !== null ? `insumos colocados em ${U().q(s.misturas, s.misturas === 1 ? 'mistura' : 'misturas')} · ${U().kgQ(s.kgFeitos)} de sal` : `falta preço: ${esc(s.semPreco.join(', '))}`}</span></div>
  </section>

  <section class="secao" aria-labelledby="t-perdas">
    <h2 id="t-perdas">Perdas e problemas</h2>
    <div class="grade-3 numeros-perda">
      <div class="numero-grande"><span class="valor">${p.quantidade}</span><span class="legenda">${p.quantidade === 1 ? 'problema' : 'problemas'}</span></div>
      <div class="numero-grande"><span class="valor">${p.kg === null ? 'sem dado' : n(p.kg)}${p.kg === null ? '' : '<small> kg</small>'}</span><span class="legenda">perdidos</span></div>
      <div class="numero-grande"><span class="valor">${p.reais === null ? 'sem dado' : U().reaisQ(p.reais, '', 0)}</span><span class="legenda">perdidos</span></div>
    </div>
    ${p.kg === null ? `<p class="ajuda">Informe quanto se perdeu nos sacos rasgados/molhados (botão INFORMAR PERDA). Já informado: ${U().kgQ(p.kgConhecido)}.</p>` : ''}
    ${p.problemas.length || p.sumicos.length ? `<ul class="lista">${p.problemas.map(linhaProblema).join('')}${p.sumicos.map(linhaSumico).join('')}</ul>` : `<p>${'<span class="selo verde">' + ic('certo', 16, 3) + 'NENHUM PROBLEMA'}</span></p>`}
  </section>

  <section class="secao" aria-labelledby="t-cabeca">
    <h2 id="t-cabeca">Custo por cabeça por dia</h2>
    <div class="numero-grande destaque-terra"><span class="valor">${s.custoCabDia !== null ? U().reaisQ(s.custoCabDia, '', 2) : 'sem dado'}</span>
      <span class="legenda">média dos lotes que receberam sal (${r.periodo.dias} ${r.periodo.dias === 1 ? 'dia' : 'dias'})</span></div>
  </section>

  <section class="secao" aria-labelledby="t-lotes">
    <h2 id="t-lotes">Previsto x realizado por lote</h2>
    <p class="ajuda">Consumo por cabeça por dia comparado à meta do técnico (época ${r.epoca ? C().EPOCAS[r.epoca].nome.toLowerCase() : 'não marcada'}). Até 10% = normal.</p>
    <ul class="lista">${s.lotes.map(linhaLote).join('') || '<li>Nenhum lote cadastrado.</li>'}</ul>
  </section>

  <section class="secao" aria-labelledby="t-estoque-r">
    <h2 id="t-estoque-r">Estoque e lista de compras</h2>
    <p class="ajuda">Estoque de hoje: o que acaba em até 15 dias ou está abaixo do mínimo, e quanto comprar para 30 dias.</p>
    ${r.estoque.length ? `<ul class="lista">${r.estoque.map(linhaEstoque).join('')}</ul>
    <div class="linha-dupla total-compra"><span>Total da compra</span><span>${U().reaisQ(totalCompras, '', 0)}${semPrecoCompra.length ? ` + ${SEM_DADO}` : ''}</span></div>
    ${semPrecoCompra.length ? `<p class="ajuda">Sem preço (fora do total): ${esc(semPrecoCompra.join(', '))}.</p>` : ''}`
    : `<p><span class="selo verde">${ic('certo', 16, 3)}NADA ACABANDO EM 15 DIAS</span></p>`}
  </section>

  <section class="secao" aria-labelledby="t-comparar">
    <h2 id="t-comparar">Comparação com a semana anterior</h2>
    <ul class="lista comparacao">
      <li class="linha-dupla"><span>Gasto</span>${variacao(cmp.gasto, (v) => reais(v))}</li>
      <li class="linha-dupla"><span>Sal feito</span>${variacao(cmp.kgFeitos, (v) => kg(v))}</li>
      <li class="linha-dupla"><span>Misturas</span>${variacao(cmp.misturas, (v) => (v === null ? SEM_DADO : `<b>${v}</b>`))}</li>
      <li class="linha-dupla"><span>Custo/cabeça/dia</span>${variacao(cmp.custoCabDia, (v) => reais(v, 2))}</li>
      <li class="linha-dupla"><span>Perdas</span>${variacao(cmp.perdasReais, (v) => reais(v))}</li>
      <li class="linha-dupla"><span>Problemas</span>${variacao(cmp.problemas, (v) => (v === null ? SEM_DADO : `<b>${v}</b>`))}</li>
    </ul>
    ${r.periodo.emAndamento ? '<p class="ajuda">Semana em andamento: compare de novo no domingo.</p>' : ''}
  </section>
</main>`,
        async ligar(raiz) {
          const DIA2 = A.resumoCalc.DIA;
          U().ao(raiz, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(raiz, '[data-acao=semana-antes]', () => A.ir('resumo', { semana: r.periodo.inicio - 7 * DIA2 }));
          U().ao(raiz, '[data-acao=semana-depois]', () => A.ir('resumo', { semana: r.periodo.inicio + 7 * DIA2 }));
          U().ao(raiz, '[data-perda]', (b) => A.ir('perda', { problemaId: b.dataset.perda, semana: r.periodo.inicio }));
          // Fotos dos problemas (guardadas no registro do problema)
          for (const img of raiz.querySelectorAll('[data-foto]')) {
            const prob = await A.db.pegar('problemas', img.dataset.foto);
            if (prob && prob.foto) img.src = prob.foto;
          }
        },
      };
    },

    // INFORMAR PERDA de um problema (saco rasgado/molhado): quantos sacos (do saco atual) ou kg
    async perda({ problemaId, semana }) {
      const prob = await A.db.pegar('problemas', problemaId);
      if (!prob) return A.telas.resumo({ semana });
      const ins = prob.insumoId ? await A.db.pegar('insumos', prob.insumoId) : null;
      const kgSaco = ins ? C().unidade(ins).kgPor : 0;
      const pk = ins ? C().precoKg(ins) : null;
      return {
        fala: `Quanto se perdeu de ${ins ? ins.nome : 'insumo'}? Escreva os sacos ou os quilos.`,
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">PERDA</h1>${U().btnFalar()}</div>
  <section class="secao">
    <h2>${esc(U().descreverProblema(prob))}</h2>
    <p class="ajuda">${esc(C().quando(prob.quando))} · ${esc(prob.pessoaNome || '—')}. A perda informada entra no resumo da semana (não mexe no estoque; a contagem acerta o estoque).</p>
  </section>
  ${kgSaco ? `<label class="rotulo" for="perda-sacos">Sacos perdidos (saco atual de ${n(kgSaco)} kg)</label>
  <div class="campo-linha"><input id="perda-sacos" class="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><span class="sufixo">sacos</span></div>` : ''}
  <label class="rotulo" for="perda-kg">Ou em kg</label>
  <div class="campo-linha"><input id="perda-kg" class="campo" type="text" inputmode="decimal" autocomplete="off" value="${esc(prob.perdaKg > 0 ? U().paraCampo(prob.perdaKg) : '')}" placeholder="0"><span class="sufixo">kg</span></div>
  <p class="preco-kg" id="perda-conta" aria-live="polite"></p>
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span></span></p>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${prob.perdaKg > 0 ? `<button class="btn" data-acao="limpar">Tirar a perda informada</button>` : ''}
</main>`,
        ligar(r) {
          const sacos = r.querySelector('#perda-sacos');
          const campoKg = r.querySelector('#perda-kg');
          const conta = r.querySelector('#perda-conta');
          const atualizar = () => {
            const v = U().lerNumero(campoKg.value);
            conta.innerHTML = v > 0 ? `= ${U().kgQ(v)} · ${pk !== null ? U().reaisQ(v * pk, '', 2) : 'R$ sem dado (insumo sem preço)'}` : '';
          };
          if (sacos) sacos.addEventListener('input', () => { const v = U().lerNumero(sacos.value); if (v >= 0) campoKg.value = U().paraCampo(v * kgSaco); atualizar(); });
          campoKg.addEventListener('input', () => { if (sacos) sacos.value = ''; atualizar(); });
          atualizar();
          U().ao(r, '[data-acao=voltar]', () => A.ir('resumo', { semana }));
          U().ao(r, '[data-acao=limpar]', async () => {
            await A.db.salvar('problemas', Object.assign({}, prob, { perdaKg: null }));
            await A.ir('resumo', { semana });
          });
          U().ao(r, '[data-acao=salvar]', async (b) => {
            const v = U().lerNumero(campoKg.value);
            if (!(v > 0)) {
              const e = r.querySelector('.erro');
              e.querySelector('span').textContent = 'Escreva quantos sacos ou quantos kg se perderam.';
              e.hidden = false;
              return;
            }
            b.disabled = true;
            await A.db.salvar('problemas', Object.assign({}, prob, { perdaKg: Math.round(v * 10) / 10 }));
            await A.ir('resumo', { semana });
            A.mostrarAviso('Perda informada');
          });
        },
      };
    },
  });
})();
