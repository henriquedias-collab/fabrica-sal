// Telas do operador para registrar: CHEGOU INSUMO e PROBLEMA.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);

  const MAX = 9999;
  // Pesos mais comuns de cada unidade (o peso do cadastro entra junto, se for diferente)
  const PESOS_COMUNS = { saco: [25, 30, 40, 50], balde: [10, 15, 20, 25], bag: [500, 750, 1000, 1200] };

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

    // CHEGOU INSUMO: quantos? e de quantos kg cada um?
    async chegadaContar({ insumoId }) {
      const ins = await A.db.pegar('insumos', insumoId);
      if (!ins) return A.telas.chegada();
      const u = C().unidade(ins);
      const num = (x) => C().numero(x);
      const passo = u.granel ? 10 : 1; // a granel conta de 10 em 10 kg
      let n = 0;
      let peso = u.kgPor; // peso de cada saco nesta chegada (começa com o saco atual do insumo)
      // Só botões: os pesos comuns + o saco atual. Peso fora disso, só o dono cadastra (Área do dono).
      const opcoes = [...new Set([...(PESOS_COMUNS[ins.unidade || 'saco'] || []), u.kgPor].filter((x) => x > 0))].sort((a, b) => a - b);
      const nome = (q) => C().nomeUnidade(q, ins);
      const UM = u.um.toUpperCase();

      const falaConta = () => (u.granel
        ? `${num(n)} quilos.`
        : `${n} ${nome(n)} de ${num(peso)} quilos. ${n} vezes ${num(peso)} dá ${num(n * peso)} quilos.`);
      const falaTela = () => (u.granel
        ? `Quantos quilos de ${ins.nome} chegaram? Cada toque no mais soma 10 quilos. Agora: ${falaConta()} Depois toque em guardar.`
        : `Quantos ${u.varios} de ${ins.nome} chegaram? Toque no mais para cada ${u.um}. Embaixo, toque no peso de cada ${u.um}. ` +
          `Agora: ${falaConta()} Depois toque em guardar.`);

      return {
        fala: falaTela(),
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">QUANTOS?</h1>${U().btnFalar()}</div>
  <div class="parte-tela" id="parte-contar">
    ${U().fotoInsumo(ins, 110)}
    <div class="nome-insumo">${esc(ins.nome.toUpperCase())}</div>
    <div class="contador">
      <button class="btn-contar" data-acao="menos" aria-label="Menos ${u.granel ? '10 quilos' : 'um ' + u.um}">${ic('menos', 56, 3)}</button>
      <div class="contador-valor">
        <span class="qtd-num" id="n">0</span>
        <span class="qtd-un" id="rotulo"></span>
      </div>
      <button class="btn-contar mais" data-acao="mais" aria-label="Mais ${u.granel ? '10 quilos' : 'um ' + u.um}">${ic('mais', 56, 3)}</button>
    </div>
    ${u.granel ? '' : `
    <div class="rotulo-peso">PESO DE CADA ${esc(UM)}</div>
    <div class="pesos" id="pesos" role="group" aria-label="Peso de cada ${esc(u.um)}"></div>`}
    <div class="conta" id="conta" aria-live="polite"></div>
    <div class="espaco"></div>
    <button class="btn verde grande" data-acao="guardar" disabled>${ic('certo', 48, 3)} GUARDAR</button>
  </div>
</main>`,
        ligar(r) {
          const btnGuardar = r.querySelector('[data-acao=guardar]');

          const desenharPesos = () => {
            const caixa = r.querySelector('#pesos');
            if (!caixa) return;
            caixa.innerHTML = opcoes.map((p) => {
              const sel = Math.abs(p - peso) < 0.05;
              return `<button class="opcao peso" data-peso="${p}" aria-pressed="${sel}">${sel ? ic('certo', 18, 3.4) : ''}${num(p)} kg</button>`;
            }).join('');
          };

          const mostrar = () => {
            r.querySelector('#n').textContent = num(n);
            r.querySelector('#rotulo').textContent = u.granel ? 'KG' : nome(n).toUpperCase();
            r.querySelector('#conta').innerHTML = u.granel
              ? `<span class="conta-total">${num(n)} kg</span>`
              : `<span class="conta-linha">${n} ${esc(nome(n))} × ${num(peso)} kg</span><span class="conta-total">= ${num(n * peso)} kg</span>`;
            btnGuardar.disabled = n <= 0;
            r.querySelector('[data-acao=menos]').disabled = n <= 0;
            A.estado.fala = falaTela(); // o alto-falante lê a conta como está agora
          };

          segurarParaRepetir(r.querySelector('[data-acao=mais]'), (vezes) => {
            n = Math.min(MAX, n + passo * (vezes || 1));
            mostrar();
          });
          segurarParaRepetir(r.querySelector('[data-acao=menos]'), (vezes) => {
            n = Math.max(0, n - passo * (vezes || 1));
            mostrar();
          });

          r.addEventListener('click', (ev) => {
            const b = ev.target.closest('button');
            if (!b) return;
            if (b.dataset.peso) { peso = Number(b.dataset.peso); desenharPesos(); mostrar(); }
          });

          desenharPesos();
          mostrar();

          U().ao(r, '[data-acao=voltar]', () => A.ir('chegada'));
          U().ao(r, '[data-acao=guardar]', async () => {
            if (n <= 0) return;
            btnGuardar.disabled = true;
            try {
              const res = await C().salvarEntrada({ insumo: ins, quantidade: n, kgPorUnidade: peso, pessoa: A.estado.pessoa });
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
      const num = (x) => C().numero(x);
      const q = entrada.quantidade;
      const pesoCada = entrada.kgPorUnidade || u.kgPor;
      const un = u.granel ? 'KG' : C().nomeUnidade(q, insumo).toUpperCase();
      const falaChegou = u.granel
        ? `Chegaram ${num(entrada.kg)} quilos de ${insumo.nome}.`
        : `${q === 1 ? 'Chegou' : 'Chegaram'} ${q} ${C().nomeUnidade(q, insumo)} de ${num(pesoCada)} quilos de ${insumo.nome}. ` +
          `${q} vezes ${num(pesoCada)} dá ${num(entrada.kg)} quilos.`;
      return {
        tom: 'verde',
        fala: `Guardado. ${falaChegou} Agora o estoque tem ${num(insumo.estoqueKg)} quilos.${entrada.pesoDiferente ? ` O saco atual agora é de ${num(pesoCada)} quilos.` : ''} Obrigado, ${p.nome}.`,
        html: `
<main class="tela verde">
  <div class="topo"><span class="vago"></span><span class="espaco"></span>${U().btnFalar()}</div>
  <div class="circulo-ok">${ic('certo', 100, 3)}</div>
  <h1 class="titulo-pronta">GUARDADO</h1>
  <div class="bloco-verde total">
    <span class="num">${esc(u.granel ? num(entrada.kg) : String(q))}</span>
    <span class="un">${esc(un)} DE ${esc(insumo.nome.toUpperCase())}</span>
    ${u.granel ? '' : `<span class="un-kg">× ${num(pesoCada)} kg = <b>${num(entrada.kg)} kg</b></span>`}
  </div>
  <div class="bloco-verde linha-info">${ic('saco', 40, 1.8)}<div><small>Estoque agora</small><b>${U().kgQ(insumo.estoqueKg)}</b></div></div>
  ${entrada.pesoDiferente ? `<div class="bloco-verde linha-info">${ic('ajustes', 40, 1.8)}<div><small>Saco atual de ${esc(insumo.nome)}</small><b>agora é de ${U().kgQ(pesoCada)}</b></div></div>` : ''}
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

  // ---------- PROBLEMA ----------

  const TIPOS = [
    { id: 'saco-rasgado', nome: 'SACO RASGADO', icone: 'rasgado', fala: 'saco rasgado', pedeInsumo: true },
    { id: 'molhado', nome: 'MOLHADO', icone: 'gota', fala: 'molhado', pedeInsumo: true },
    { id: 'maquina-parada', nome: 'MÁQUINA PARADA', icone: 'maquina', fala: 'máquina parada', pedeInsumo: false },
    { id: 'faltou-insumo', nome: 'FALTOU INSUMO', icone: 'vazio', fala: 'faltou insumo', pedeInsumo: true },
  ];
  const tipoPorId = (id) => TIPOS.find((t) => t.id === id);
  const GRAVACAO_MAX = 60; // segundos

  function minutos(seg) {
    return Math.floor(seg / 60) + ':' + String(Math.floor(seg % 60)).padStart(2, '0');
  }

  Object.assign(A.telas, {
    // PROBLEMA: qual?
    async problema() {
      return {
        fala: 'Qual é o problema? ' + TIPOS.map((t) => t.fala + '.').join(' '),
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">QUAL PROBLEMA?</h1>${U().btnFalar()}</div>
  <div class="grade-problemas">
    ${TIPOS.map((t) => `
    <button class="cartao-problema" data-tipo="${t.id}">${ic(t.icone, 76, 1.8)}<span>${t.nome}</span></button>`).join('')}
  </div>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('inicio'));
          U().ao(r, '[data-tipo]', (b) => {
            const t = tipoPorId(b.dataset.tipo);
            A.ir(t.pedeInsumo ? 'problemaInsumo' : 'problemaDetalhe', { tipo: t.id });
          });
        },
      };
    },

    // PROBLEMA: com qual insumo?
    async problemaInsumo({ tipo }) {
      const t = tipoPorId(tipo);
      const insumos = await insumosOrdenados();
      return {
        fala: `${t.fala}. Qual insumo? Toque na foto. ` + insumos.map((i) => i.nome + '.').join(' '),
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">QUAL INSUMO?</h1>${U().btnFalar()}</div>
  <div class="selo-problema">${ic(t.icone, 36, 2)} ${t.nome}</div>
  ${cartoesInsumo(insumos)}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('problema'));
          U().ao(r, '[data-insumo]', (b) => A.ir('problemaDetalhe', { tipo, insumoId: b.dataset.insumo }));
        },
      };
    },

    // PROBLEMA: falar e foto (os dois opcionais) e guardar
    async problemaDetalhe({ tipo, insumoId }) {
      const t = tipoPorId(tipo);
      const ins = insumoId ? await A.db.pegar('insumos', insumoId) : null;
      const e = { audio: null, segundos: 0, foto: null };
      let gravador = null;
      let microfone = null;
      let relogio = null;
      let urlAudio = null;
      return {
        fala: 'Se quiser, toque em falar e conte o que aconteceu, ou tire uma foto. Depois toque em guardar aviso.',
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">CONTE MAIS</h1>${U().btnFalar()}</div>
  <div class="selo-problema">${ic(t.icone, 36, 2)} ${t.nome}${ins ? ' · ' + esc(ins.nome.toUpperCase()) : ''}</div>
  <div id="bloco-audio"></div>
  <div id="bloco-foto"></div>
  <input type="file" accept="image/*" capture="environment" id="arquivo-foto" hidden>
  <p class="ajuda centro">Falar e foto não são obrigatórios.</p>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="guardar" style="font-size:30px">${ic('certo', 44, 3)} GUARDAR AVISO</button>
</main>`,
        ligar(r) {
          const blocoAudio = r.querySelector('#bloco-audio');
          const blocoFoto = r.querySelector('#bloco-foto');
          const arquivo = r.querySelector('#arquivo-foto');

          const pararMicrofone = () => {
            clearInterval(relogio);
            if (microfone) microfone.getTracks().forEach((tr) => tr.stop());
            microfone = null;
          };

          const desenharAudio = () => {
            if (gravador && gravador.state === 'recording') {
              blocoAudio.innerHTML = `
    <button class="btn vermelho grande gravando" data-acao="parar">${ic('parar', 44, 2.4)} PARAR <span class="relogio">${minutos(e.segundos)}</span></button>`;
            } else if (e.audio) {
              if (urlAudio) URL.revokeObjectURL(urlAudio);
              urlAudio = URL.createObjectURL(e.audio);
              blocoAudio.innerHTML = `
    <div class="linha-anexo">
      <button class="btn" data-acao="ouvir">${ic('tocar', 34, 2.4)} OUVIR ${minutos(e.segundos)}</button>
      <button class="btn-redondo" data-acao="apagar-audio" aria-label="Apagar a gravação">${ic('lixo', 30, 2.2)}</button>
    </div>
    <audio id="player" src="${urlAudio}" preload="auto"></audio>`;
            } else {
              blocoAudio.innerHTML = `
    <button class="btn grande" data-acao="falar">${ic('microfone', 48, 2)} FALAR</button>`;
            }
          };

          const desenharFoto = () => {
            blocoFoto.innerHTML = e.foto
              ? `<div class="linha-anexo">
      <img class="foto-anexo" src="${e.foto}" alt="Foto do problema">
      <button class="btn-redondo" data-acao="apagar-foto" aria-label="Apagar a foto">${ic('lixo', 30, 2.2)}</button>
    </div>`
              : `<button class="btn grande" data-acao="foto">${ic('camera', 48, 1.8)} FOTO</button>`;
          };

          const comecarGravacao = async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
              A.mostrarAviso('Este aparelho não deixa gravar aqui', 'laranja');
              return;
            }
            A.voz.parar();
            try {
              microfone = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
              A.mostrarAviso('Sem permissão para usar o microfone', 'laranja');
              A.voz.falar('O celular não deixou usar o microfone.');
              return;
            }
            const pedacos = [];
            gravador = new MediaRecorder(microfone);
            gravador.ondataavailable = (ev) => { if (ev.data && ev.data.size) pedacos.push(ev.data); };
            gravador.onstop = () => {
              pararMicrofone();
              e.audio = pedacos.length ? new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' }) : null;
              desenharAudio();
            };
            e.segundos = 0;
            gravador.start();
            relogio = setInterval(() => {
              e.segundos++;
              const rel = blocoAudio.querySelector('.relogio');
              if (rel) rel.textContent = minutos(e.segundos);
              if (e.segundos >= GRAVACAO_MAX) gravador.stop();
            }, 1000);
            desenharAudio();
          };

          // Um só "ouvinte" para os botões que mudam (falar, parar, ouvir, apagar, foto)
          r.addEventListener('click', async (ev) => {
            const b = ev.target.closest('[data-acao]');
            if (!b) return;
            const acao = b.dataset.acao;
            if (acao === 'falar') comecarGravacao();
            if (acao === 'parar' && gravador && gravador.state === 'recording') gravador.stop();
            if (acao === 'ouvir') { A.voz.parar(); r.querySelector('#player').play(); }
            if (acao === 'apagar-audio') { e.audio = null; e.segundos = 0; desenharAudio(); }
            if (acao === 'foto') arquivo.click();
            if (acao === 'apagar-foto') { e.foto = null; desenharFoto(); }
          });

          arquivo.addEventListener('change', async () => {
            const f = arquivo.files && arquivo.files[0];
            if (!f) return;
            try {
              e.foto = await U().reduzirFoto(f, 720);
              desenharFoto();
            } catch (err) {
              A.mostrarAviso('Não deu para usar essa foto', 'laranja');
            }
            arquivo.value = '';
          });

          desenharAudio();
          desenharFoto();

          U().ao(r, '[data-acao=voltar]', () => {
            if (gravador && gravador.state === 'recording') { gravador.onstop = null; gravador.stop(); }
            pararMicrofone();
            A.ir(t.pedeInsumo ? 'problemaInsumo' : 'problema', { tipo });
          });

          U().ao(r, '[data-acao=guardar]', async (b) => {
            if (gravador && gravador.state === 'recording') {
              // terminou de falar sem tocar em PARAR: termina a gravação e guarda junto
              await new Promise((ok) => { const antes = gravador.onstop; gravador.onstop = () => { antes(); ok(); }; gravador.stop(); });
            }
            b.disabled = true;
            const p = A.estado.pessoa;
            const registro = {
              id: A.db.novoId('problema'), tipo, quando: new Date().toISOString(),
              insumoId: ins ? ins.id : null, insumoNome: ins ? ins.nome : null,
              audio: e.audio, audioSegundos: e.audio ? e.segundos : 0, foto: e.foto,
              pessoaId: p.id, pessoaNome: p.nome, exemplo: false,
            };
            try {
              await A.db.salvar('problemas', registro);
            } catch (err) {
              b.disabled = false;
              A.mostrarAviso('Não guardou. Tente de novo.', 'laranja');
              return;
            }
            if (urlAudio) URL.revokeObjectURL(urlAudio);
            A.ir('problemaPronto', { problema: registro });
          });
        },
      };
    },

    // PROBLEMA: guardado (tela verde)
    async problemaPronto({ problema }) {
      const t = tipoPorId(problema.tipo);
      const p = A.estado.pessoa;
      const anexos = [problema.audio ? 'gravação' : null, problema.foto ? 'foto' : null].filter(Boolean);
      return {
        tom: 'verde',
        fala: `Aviso guardado. ${t.fala[0].toUpperCase() + t.fala.slice(1)}${problema.insumoNome ? ', ' + problema.insumoNome : ''}. O dono vai ver na área do dono. Obrigado, ${p.nome}.`,
        html: `
<main class="tela verde">
  <div class="topo"><span class="vago"></span><span class="espaco"></span>${U().btnFalar()}</div>
  <div class="circulo-ok">${ic('certo', 100, 3)}</div>
  <h1 class="titulo-pronta">AVISO GUARDADO</h1>
  <div class="bloco-verde linha-info">${ic(t.icone, 44, 2)}<div><small>Problema</small><b>${t.nome}${problema.insumoNome ? ' · ' + esc(problema.insumoNome) : ''}</b></div></div>
  ${anexos.length ? `<div class="bloco-verde linha-info">${ic(problema.audio ? 'microfone' : 'camera', 40, 2)}<div><small>Junto do aviso</small><b>${anexos.join(' e ')}</b></div></div>` : ''}
  <div class="bloco-verde linha-info">${U().avatar(p, 48)}<div><small>Quem avisou · quando</small><b>${esc(p.nome)} · ${esc(C().quando(problema.quando))}</b></div></div>
  <p class="nota-verde">Fica guardado neste celular. O dono vê em Área do dono → Registros.</p>
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
