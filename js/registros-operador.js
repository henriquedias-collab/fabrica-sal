// Telas do operador para registrar: CHEGOU INSUMO e PROBLEMA.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);

  const MAX = 9999;

  // Cartões grandes de insumo (foto ou cor + nome), usados para escolher
  function cartoesInsumo(insumos) {
    return `<div class="grade-insumos">${insumos.map((i) => `
    <button class="cartao-insumo" data-insumo="${esc(i.id)}" style="background:${i.cor};color:${i.corTexto}">
      ${i.foto ? `<img src="${i.foto}" alt="">` : ic('saco', 64, 1.6)}
      <span class="nome">${esc(i.nome)}</span>
    </button>`).join('')}</div>`;
  }

  async function insumosOrdenados() {
    return (await A.db.todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // Botão que repete enquanto o dedo fica apertado (acelera depois de um tempo)
  function segurarParaRepetir(botao, acao) {
    let espera = null;
    let repete = null;
    let vezes = 0;
    const parar = () => { clearTimeout(espera); clearInterval(repete); espera = repete = null; };
    botao.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      parar();
      vezes = 0;
      acao();
      espera = setTimeout(() => {
        repete = setInterval(() => {
          vezes++;
          acao(vezes > 15 ? 5 : 1); // depois de um tempo, anda de 5 em 5
        }, 140);
      }, 500);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => botao.addEventListener(t, parar));
    botao.addEventListener('contextmenu', (ev) => ev.preventDefault());
    // teclado (Enter/Espaço) gera clique sem ponteiro
    botao.addEventListener('click', (ev) => { if (ev.detail === 0) acao(); });
  }

  Object.assign(A.telas, {
    // CHEGOU INSUMO: qual?
    async chegada() {
      const insumos = await insumosOrdenados();
      return {
        fala: insumos.length
          ? 'Qual insumo chegou? Toque na foto. ' + insumos.map((i) => i.nome + '.').join(' ')
          : 'Nenhum insumo cadastrado. Peça para o dono cadastrar.',
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">O QUE CHEGOU?</h1>${U().btnFalar()}</div>
  ${insumos.length ? cartoesInsumo(insumos) : '<p class="vazio">Nenhum insumo cadastrado. Peça para o dono cadastrar.</p>'}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('inicio'));
          U().ao(r, '[data-insumo]', (b) => A.ir('chegadaContar', { insumoId: b.dataset.insumo }));
        },
      };
    },

    // CHEGOU INSUMO: quantos?
    async chegadaContar({ insumoId }) {
      const ins = await A.db.pegar('insumos', insumoId);
      if (!ins) return A.telas.chegada();
      const u = C().unidade(ins);
      const passo = u.granel ? 10 : 1; // a granel conta de 10 em 10 kg
      let n = 0;
      const rotulo = () => (u.granel ? 'KG' : C().nomeUnidade(n, ins).toUpperCase());
      const kgTexto = () => (u.granel ? '' : `= ${C().numero(n * u.kgPor)} kg`);
      return {
        fala: u.granel
          ? `Quantos quilos de ${ins.nome} chegaram? Cada toque no mais soma 10 quilos. Depois toque em guardar.`
          : `Quantos ${u.varios} de ${ins.nome} chegaram? Toque no mais para cada ${u.um}. Segure apertado para ir mais rápido. Depois toque em guardar.`,
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">QUANTOS?</h1>${U().btnFalar()}</div>
  ${U().fotoInsumo(ins, 130)}
  <div class="nome-insumo">${esc(ins.nome.toUpperCase())}</div>
  <div class="contador">
    <button class="btn-contar" data-acao="menos" aria-label="Menos ${u.granel ? '10 quilos' : 'um ' + u.um}">${ic('menos', 56, 3)}</button>
    <div class="contador-valor" aria-live="polite">
      <span class="qtd-num" id="n">0</span>
      <span class="qtd-un" id="rotulo">${esc(rotulo())}</span>
    </div>
    <button class="btn-contar mais" data-acao="mais" aria-label="Mais ${u.granel ? '10 quilos' : 'um ' + u.um}">${ic('mais', 56, 3)}</button>
  </div>
  <div class="qtd-kg centro" id="kg">${esc(kgTexto())}</div>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="guardar" disabled>${ic('certo', 48, 3)} GUARDAR</button>
</main>`,
        ligar(r) {
          const btnGuardar = r.querySelector('[data-acao=guardar]');
          const mostrar = () => {
            r.querySelector('#n').textContent = C().numero(n);
            r.querySelector('#rotulo').textContent = rotulo();
            r.querySelector('#kg').textContent = kgTexto();
            btnGuardar.disabled = n <= 0;
            r.querySelector('[data-acao=menos]').disabled = n <= 0;
          };
          segurarParaRepetir(r.querySelector('[data-acao=mais]'), (vezes) => {
            n = Math.min(MAX, n + passo * (vezes || 1));
            mostrar();
          });
          segurarParaRepetir(r.querySelector('[data-acao=menos]'), (vezes) => {
            n = Math.max(0, n - passo * (vezes || 1));
            mostrar();
          });
          mostrar();
          U().ao(r, '[data-acao=voltar]', () => A.ir('chegada'));
          U().ao(r, '[data-acao=guardar]', async () => {
            if (n <= 0) return;
            btnGuardar.disabled = true;
            try {
              const res = await C().salvarEntrada({ insumo: ins, quantidade: n, pessoa: A.estado.pessoa });
              A.ir('chegadaPronta', res);
            } catch (e) {
              btnGuardar.disabled = false;
              A.mostrarAviso('Não guardou. Tente de novo.', 'laranja');
            }
          });
        },
      };
    },

    // CHEGOU INSUMO: guardado (tela verde)
    async chegadaPronta({ entrada, insumo }) {
      const p = A.estado.pessoa;
      const u = C().unidade(insumo);
      const grande = u.granel ? C().numero(entrada.kg) : String(entrada.quantidade);
      const un = u.granel ? 'KG' : C().nomeUnidade(entrada.quantidade, insumo).toUpperCase();
      return {
        tom: 'verde',
        fala: `Guardado. ${!u.granel && entrada.quantidade === 1 ? 'Chegou' : 'Chegaram'} ${u.granel ? C().numero(entrada.kg) + ' quilos' : entrada.quantidade + ' ' + C().nomeUnidade(entrada.quantidade, insumo)} de ${insumo.nome}. ` +
          `Agora tem ${C().qtdFala(insumo.estoqueKg, insumo)}. Obrigado, ${p.nome}.`,
        html: `
<main class="tela verde">
  <div class="topo"><span class="vago"></span><span class="espaco"></span>${U().btnFalar()}</div>
  <div class="circulo-ok">${ic('certo', 100, 3)}</div>
  <h1 class="titulo-pronta">GUARDADO</h1>
  <div class="bloco-verde total">
    <span class="num">${esc(grande)}</span>
    <span class="un">${esc(un)} DE ${esc(insumo.nome.toUpperCase())}</span>
    ${u.granel ? '' : `<span class="un-kg">= ${C().numero(entrada.kg)} kg</span>`}
  </div>
  <div class="bloco-verde linha-info">${ic('saco', 40, 1.8)}<div><small>Estoque agora</small><b>${esc(C().qtdTexto(insumo.estoqueKg, insumo))}</b></div></div>
  <div class="bloco-verde linha-info">${U().avatar(p, 48)}<div><small>Quem recebeu · quando</small><b>${esc(p.nome)} · ${esc(C().quando(entrada.quando))}</b></div></div>
  <div class="espaco"></div>
  <button class="btn branco-no-verde" data-acao="inicio">${ic('casa', 44, 2.4)} INÍCIO</button>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=inicio]', () => A.ir('inicio'));
        },
      };
    },
  });
})();
