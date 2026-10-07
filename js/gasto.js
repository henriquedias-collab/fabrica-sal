// GASTO POR SEMANA (todas as semanas desde a primeira mistura) e PREÇO PAGO das compras (área do dono).
// As contas ficam em resumo-calculo.js (historico) e custo-calculo.js (custo médio do galpão), puras.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);
  const n = (x) => C().numero(x);
  const SEM_DADO = '<span class="sem-dado">sem dado</span>';
  const ESTIMADO = '<span class="etiqueta laranja estimado">estimado</span>';
  const reais = (v, casas) => (v === null || v === undefined ? SEM_DADO : U().reaisQ(v, '', casas === undefined ? 0 : casas));

  async function dadosHistorico() {
    const [misturas, insumos, pastos, problemas, contagens, epoca, nomeFazenda] = await Promise.all([
      A.db.todos('misturas'), A.db.todos('insumos'), A.db.todos('pastos'), A.db.todos('problemas'), A.db.todos('contagens'),
      A.db.config('epocaAtual'), A.db.config('nomeFazenda'),
    ]);
    return A.resumoCalc.historico({ misturas, insumos, pastos, problemas, contagens, epoca, nomeFazenda });
  }

  // Chegadas que ainda não têm o preço pago (a mais nova primeiro)
  async function comprasSemPreco() {
    return (await A.db.todos('entradas')).filter((e) => !(e.precoKg > 0)).sort((a, b) => b.quando.localeCompare(a.quando));
  }

  Object.assign(A.telas, {
    // GASTO POR SEMANA
    async gastoSemanas() {
      const h = await dadosHistorico();
      const tt = h.total;
      const whatsDono = A.pdf.numeroWhats(await A.db.config('whatsDono'));
      const linha = (s) => `
      <li><button class="item-semana" data-semana="${s.inicio}">
        <span class="linha-dupla"><b>${esc(s.rotulo)}/${s.ano}</b>${s.emAndamento ? '<span class="etiqueta">em andamento</span>' : ''}</span>
        <span class="linha-dupla gasto-semana"><span class="valor">${s.gasto !== null ? U().reaisQ(s.gasto, '', 0) : 'sem dado'}</span>${s.gastoEstimado ? ESTIMADO : ''}${ic('seguir', 24, 2.4)}</span>
        ${s.gasto === null && s.semPreco.length ? `<span class="detalhe">falta preço: ${esc(s.semPreco.join(', '))}</span>` : ''}
        <span class="detalhe">${U().q(s.misturas, s.misturas === 1 ? 'mistura' : 'misturas')} · ${U().kgQ(s.kgFeitos)} de sal · perdas ${reais(s.perdasReais)} · ${s.custoCabDia !== null ? U().reaisQ(s.custoCabDia, '/cab/dia', 2) : 'custo/cab/dia: ' + SEM_DADO}</span>
      </button></li>`;
      const fala = h.semanas.length
        ? `Gasto por semana. ${h.semanas.length} semanas desde a primeira mistura. Gasto total: ${n(Math.round(tt.gasto))} reais${tt.gastoEstimado ? ', em parte estimado' : ''}. Toque numa semana para ver o resumo dela.`
        : 'Gasto por semana. Ainda não tem nenhuma mistura registrada.';
      return {
        fala,
        html: `
<main class="tela painel">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">GASTO POR SEMANA</h1>${U().btnFalar()}</div>
  <p class="ajuda">Todas as semanas desde a primeira mistura (segunda a domingo). Gasto = insumos colocados nas misturas, pelo custo do dia de cada mistura. ${ESTIMADO} = alguma compra sem preço pago (ou mistura antiga): usou o preço cadastrado.</p>
  ${h.semanas.length ? `
  <ul class="lista semanas">${h.semanas.map(linha).join('')}</ul>
  <section class="secao total-geral" aria-labelledby="t-total">
    <h2 id="t-total">Total geral</h2>
    <div class="numero-grande destaque-terra"><span class="valor">${U().reaisQ(tt.gasto, '', 0)}${tt.gastoIncompleto ? ' <small>+ sem dado</small>' : ''}</span>
      <span class="legenda">${tt.semanas} ${tt.semanas === 1 ? 'semana' : 'semanas'} · ${U().q(tt.misturas, tt.misturas === 1 ? 'mistura' : 'misturas')} · ${U().kgQ(tt.kgFeitos)} de sal</span></div>
    ${tt.gastoEstimado ? `<p>${ESTIMADO} parte do gasto usou o preço cadastrado.</p>` : ''}
    <ul class="lista comparacao">
      <li class="linha-dupla"><span>Média por semana</span><b>${U().reaisQ(tt.gasto / tt.semanas, '', 0)}</b></li>
      <li class="linha-dupla"><span>Perdas</span><span>${U().reaisQ(tt.perdasReais, '', 0)}${tt.perdasIncompleto ? ' + ' + SEM_DADO : ''} · ${U().q(tt.problemas, tt.problemas === 1 ? 'problema' : 'problemas')}</span></li>
      <li class="linha-dupla"><span>Custo/cabeça/dia (média)</span><span>${tt.custoCabDia !== null ? U().reaisQ(tt.custoCabDia, '', 2) : SEM_DADO}</span></li>
    </ul>
  </section>
  <button class="btn verde grande" data-acao="whats">${ic('whats', 44, 2.2)} ENVIAR NO WHATSAPP</button>
  <button class="btn" data-acao="pdf">${ic('baixar', 32, 2.4)} BAIXAR PDF</button>` : '<p class="vazio">Nenhuma mistura registrada ainda.</p>'}
</main>`,
        ligar(raiz) {
          U().ao(raiz, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(raiz, '[data-semana]', (b) => A.ir('resumo', { semana: Number(b.dataset.semana), volta: 'gastoSemanas' }));
          if (!h.semanas.length) return;
          let feito = null;
          const fazerPdf = () => (feito = feito || A.pdfRelatorios.historico(h).catch((e) => { feito = null; throw e; }));
          fazerPdf().catch((e) => console.warn(e));
          U().ao(raiz, '[data-acao=whats]', async (b) => {
            b.disabled = true;
            try {
              const { blob, nome } = await fazerPdf();
              const como = await A.pdf.compartilhar(blob, nome, A.resumoCalc.mensagemHistorico(h), whatsDono);
              if (como === 'whatsapp') A.mostrarAviso('PDF salvo no celular. No WhatsApp, anexe o PDF (clipe).');
              else if (como === 'compartilhado') A.mostrarAviso('Enviado. A mensagem também foi copiada: se não aparecer, cole.');
            } catch (e) {
              console.error(e);
              A.mostrarAviso('Não deu para enviar. Tente BAIXAR PDF.', 'laranja');
            }
            b.disabled = false;
          });
          U().ao(raiz, '[data-acao=pdf]', async (b) => {
            b.disabled = true;
            try {
              const { blob, nome } = await fazerPdf();
              A.pdf.baixar(blob, nome);
              A.mostrarAviso('PDF pronto: ' + nome);
            } catch (e) {
              console.error(e);
              A.mostrarAviso('Não deu para fazer o PDF. Tente de novo.', 'laranja');
            }
            b.disabled = false;
          });
        },
      };
    },

    // COMPRAS SEM PREÇO PAGO: lista para o dono informar o preço de cada chegada
    async comprasSemPreco() {
      const lista = await comprasSemPreco();
      return {
        fala: lista.length ? `${lista.length} ${lista.length === 1 ? 'chegada sem preço pago' : 'chegadas sem preço pago'}. Toque numa para escrever quanto pagou.` : 'Todas as chegadas têm preço pago.',
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">PREÇO PAGO</h1>${U().btnFalar()}</div>
  <p class="ajuda">O custo de cada mistura sai do que foi pago nas compras que estão no galpão. Chegada sem preço pago usa o preço cadastrado e o gasto fica "estimado".</p>
  ${lista.length ? `<ul class="lista">${lista.map((e) => `
    <li class="item-painel"><div class="linha-dupla"><b>${esc(e.insumoNome)}</b><button class="btn-pequeno largo" data-entrada="${esc(e.id)}">INFORMAR</button></div>
      <span class="detalhe">${esc(C().quando(e.quando))} · ${esc(e.texto)} · ${esc(e.pessoaNome || '—')}</span></li>`).join('')}</ul>`
    : `<p><span class="selo verde">${ic('certo', 16, 3)}TODAS COM PREÇO PAGO</span></p>`}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-entrada]', (b) => A.ir('precoCompra', { entradaId: b.dataset.entrada, volta: 'comprasSemPreco' }));
        },
      };
    },

    // PREÇO PAGO numa chegada: preço do saco (ou do kg, a granel) ou o total da nota
    async precoCompra({ entradaId, volta }) {
      const voltar = () => A.ir(volta || 'registros');
      const e = await A.db.pegar('entradas', entradaId);
      if (!e) return A.telas[volta || 'registros']({});
      const saco = e.unidade !== 'kg' && e.kgPorUnidade > 0 ? e.kgPorUnidade : 0;
      const atual = e.precoKg > 0 ? e.precoKg : null;
      return {
        fala: `Preço pago de ${e.insumoNome}. Escreva o preço ${saco ? 'do saco' : 'do quilo'}, ou o total da nota.`,
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">PREÇO PAGO</h1>${U().btnFalar()}</div>
  <section class="secao">
    <h2>${esc(e.insumoNome)}</h2>
    <p>${esc(e.texto)}</p>
    <p class="ajuda">Chegou ${esc(C().quando(e.quando))} · recebido por ${esc(e.pessoaNome || '—')}</p>
  </section>
  <label class="rotulo" for="preco-un">${saco ? `Preço do saco de ${n(saco)} kg` : 'Preço do kg'}</label>
  <div class="campo-linha"><span class="sufixo">R$</span><input id="preco-un" class="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"
    value="${atual !== null ? esc(U().paraCampo(Math.round((saco ? atual * saco : atual) * 100) / 100)) : ''}"><span class="sufixo">/${saco ? 'saco' : 'kg'}</span></div>
  <label class="rotulo" for="preco-total">Ou o total pago nesta chegada</label>
  <div class="campo-linha"><span class="sufixo">R$</span><input id="preco-total" class="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"><span class="sufixo">total</span></div>
  <p class="preco-kg" id="preco-conta" aria-live="polite"></p>
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span>Escreva o preço do ${saco ? 'saco' : 'kg'} ou o total pago.</span></p>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${atual !== null ? '<button class="btn" data-acao="tirar">Tirar o preço pago</button>' : ''}
</main>`,
        ligar(r) {
          const un = r.querySelector('#preco-un');
          const total = r.querySelector('#preco-total');
          const conta = r.querySelector('#preco-conta');
          const precoKg = () => {
            const t = U().lerNumero(total.value);
            if (t > 0 && e.kg > 0) return t / e.kg;
            const v = U().lerNumero(un.value);
            return v > 0 ? (saco ? v / saco : v) : null;
          };
          const atualizar = () => {
            const pk = precoKg();
            conta.innerHTML = pk ? `= ${U().reaisQ(pk, '/kg', 2)} · total ${U().reaisQ(pk * e.kg, '', 2)}` : '';
          };
          un.addEventListener('input', () => { total.value = ''; atualizar(); });
          total.addEventListener('input', () => { un.value = ''; atualizar(); });
          atualizar();
          U().ao(r, '[data-acao=voltar]', voltar);
          const salvar = async (pk, b) => {
            b.disabled = true;
            try {
              const res = await C().informarPrecoCompra(e.id, pk);
              await voltar();
              A.mostrarAviso(pk ? `Preço pago salvo${res.misturas ? ` · ${res.misturas} ${res.misturas === 1 ? 'mistura recalculada' : 'misturas recalculadas'}` : ''}` : 'Preço pago tirado');
            } catch (err) {
              console.error(err);
              b.disabled = false;
              A.mostrarAviso('Não deu para salvar. Tente de novo.', 'laranja');
            }
          };
          U().ao(r, '[data-acao=salvar]', (b) => {
            const pk = precoKg();
            if (!pk) { r.querySelector('.erro').hidden = false; return; }
            salvar(pk, b);
          });
          U().ao(r, '[data-acao=tirar]', (b) => salvar(null, b));
        },
      };
    },
  });

  A.gasto = { comprasSemPreco };
})();
