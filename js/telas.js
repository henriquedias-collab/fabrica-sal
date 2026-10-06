// As telas do app. Cada tela devolve:
//   html  -> o que aparece
//   fala  -> o que o alto-falante lê
//   ligar -> liga os botões depois que a tela aparece
//   tom   -> 'verde' para a tela de mistura pronta (fundo verde)
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;

  // ---------- pedaços reutilizados ----------

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ICONES = {
    som: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    voltar: '<path d="M15 18l-6-6 6-6"/>',
    certo: '<path d="M4 12.5 9.5 18 20 6"/>',
    misturar: '<path d="M4 10h16l-1.5 9.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5L4 10z"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M9 15h6"/>',
    caminhao: '<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    problema: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/>',
    atencao: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    deposito: '<path d="M3 10 12 4l9 6v10H3z"/><path d="M9 20v-6h6v6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    mais: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    saco: '<path d="M8.5 3h7l-1.5 3.2c3 1.4 5 4.4 5 8.3 0 4.2-3 6.5-7 6.5s-7-2.3-7-6.5c0-3.9 2-6.9 5-8.3L8.5 3z"/><path d="M10 6.2h4"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3"/><path d="M17 6l3 3"/>',
    mensagem: '<path d="M4 5h16v11H8l-4 4V5z"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    pasto: '<path d="M3 20h18"/><path d="M6 20v-5M6 15c0-2 1-3 2-4M6 15c0-2-1-3-2-4"/><path d="M15 20v-8M15 12c0-2.5 1.5-4 3-5M15 12c0-2.5-1.5-4-3-5"/>',
    seguir: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  };

  function ic(nome, tam, traco) {
    return `<svg width="${tam || 28}" height="${tam || 28}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${traco || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;
  }

  function btnFalar() {
    return `<button class="btn-redondo escuro" data-falar aria-label="Ouvir a instrução" aria-pressed="false">${ic('som', 30)}</button>`;
  }
  function btnVoltar() {
    return `<button class="btn-redondo" data-acao="voltar" aria-label="Voltar">${ic('voltar', 30, 2.6)}</button>`;
  }

  function avatar(p, tam) {
    const estilo = `width:${tam}px;height:${tam}px;--cor:${p.cor};`;
    if (p.foto) return `<img class="avatar" src="${p.foto}" alt="" style="${estilo}">`;
    return `<span class="avatar" aria-hidden="true" style="${estilo}background:${p.cor};font-size:${Math.round(tam * 0.38)}px">${esc(C().iniciais(p.nome))}</span>`;
  }

  // Quadro do insumo: foto, se tiver; senão cor + saco + nome
  function fotoInsumo(ins, altura) {
    const estilo = `background:${ins.cor};color:${ins.corTexto};${altura ? 'height:' + altura + 'px' : ''}`;
    if (ins.foto) return `<div class="foto-insumo" style="${estilo}"><img src="${ins.foto}" alt="${esc(ins.nome)}"></div>`;
    return `<div class="foto-insumo" style="${estilo}">${ic('saco', 76, 1.6)}<span>${esc(ins.nome)}</span></div>`;
  }

  function porId(lista) {
    const m = {};
    lista.forEach((x) => { m[x.id] = x; });
    return m;
  }

  function ao(raiz, seletor, fn) {
    raiz.querySelectorAll(seletor).forEach((el) => el.addEventListener('click', () => fn(el)));
  }

  function textoDestino(d) {
    return d.tipo === 'deposito' ? 'Depósito' : `Pasto ${d.numero} · ${d.nome}`;
  }

  // ---------- telas ----------

  A.telas = {
    // QUEM É VOCÊ?
    async quem() {
      const pessoas = (await A.db.todos('pessoas'))
        .filter((p) => p.ativo !== false)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const podeVoltar = !!A.estado.pessoa;
      return {
        fala: pessoas.length ? 'Quem é você? Toque na sua foto.' : 'Ninguém cadastrado ainda. Toque em nova pessoa.',
        html: `
<main class="tela">
  <div class="topo">${podeVoltar ? btnVoltar() : '<span class="vago"></span>'}<h1 class="titulo">QUEM É VOCÊ?</h1>${btnFalar()}</div>
  <div class="grade-2">
    ${pessoas.map((p) => `
    <button class="cartao-pessoa" data-pessoa="${esc(p.id)}" style="--cor:${p.cor}">
      ${avatar(p, 112)}<span class="nome">${esc(p.nome)}</span>
    </button>`).join('') || '<p class="vazio">Ninguém cadastrado ainda.</p>'}
  </div>
  <div class="espaco"></div>
  <button class="btn" data-acao="nova">${ic('mais', 34, 2.6)} NOVA PESSOA</button>
  <button class="btn-texto" data-acao="dono">${ic('ajustes', 24)} Área do dono</button>
</main>`,
        ligar(r) {
          ao(r, '[data-pessoa]', async (b) => {
            const p = pessoas.find((x) => x.id === b.dataset.pessoa);
            A.estado.pessoa = p;
            await A.db.definir('pessoaAtual', p.id);
            A.ir('inicio');
          });
          ao(r, '[data-acao=voltar]', () => A.ir('inicio'));
          ao(r, '[data-acao=nova]', () => A.ir('novaPessoa'));
          ao(r, '[data-acao=dono]', () => A.ir('dono'));
        },
      };
    },

    // CADASTRO DE PESSOA
    async novaPessoa() {
      const cores = ['#1d6b3a', '#1f4fa0', '#a65300', '#5b3a8a', '#0f6b6b', '#8c2257'];
      const escolha = { cor: cores[0], funcao: 'operador', foto: null };
      return {
        fala: 'Cadastro de pessoa. Tire a foto, escreva o nome, escolha a cor e toque em salvar.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">NOVA PESSOA</h1>${btnFalar()}</div>
  <button class="foto-pessoa" data-acao="foto" aria-label="Tirar foto">${ic('camera', 56, 1.8)}<span>TIRAR FOTO</span></button>
  <input type="file" accept="image/*" capture="user" id="arquivo-foto" hidden>
  <label class="rotulo" for="nome-pessoa">Nome</label>
  <input id="nome-pessoa" class="campo" type="text" autocomplete="off" autocapitalize="words" maxlength="30" placeholder="Ex.: João">
  <div class="rotulo">Função</div>
  <div class="grade-2">
    <button class="opcao" data-funcao="operador" aria-pressed="true">${ic('pessoa', 28)} OPERADOR</button>
    <button class="opcao" data-funcao="dono" aria-pressed="false">${ic('chave', 28)} DONO</button>
  </div>
  <div class="rotulo">Cor</div>
  <div class="cores">
    ${cores.map((c, k) => `<button class="cor" data-cor="${c}" style="background:${c}" aria-label="Cor ${k + 1}" aria-pressed="${k === 0}">${ic('certo', 26, 3)}</button>`).join('')}
  </div>
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span>Escreva o nome.</span></p>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
</main>`,
        ligar(r) {
          const arquivo = r.querySelector('#arquivo-foto');
          const btnFoto = r.querySelector('[data-acao=foto]');
          const campo = r.querySelector('#nome-pessoa');
          const erro = r.querySelector('.erro');

          ao(r, '[data-acao=voltar]', () => A.ir('quem'));
          btnFoto.addEventListener('click', () => arquivo.click());
          arquivo.addEventListener('change', async () => {
            const f = arquivo.files && arquivo.files[0];
            if (!f) return;
            try {
              escolha.foto = await reduzirFoto(f, 320);
              btnFoto.innerHTML = `<img src="${escolha.foto}" alt="Foto escolhida">`;
              btnFoto.classList.add('com-foto');
            } catch (e) {
              A.mostrarAviso('Não deu para usar essa foto', 'laranja');
            }
          });
          ao(r, '[data-funcao]', (b) => {
            escolha.funcao = b.dataset.funcao;
            r.querySelectorAll('[data-funcao]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
          });
          ao(r, '[data-cor]', (b) => {
            escolha.cor = b.dataset.cor;
            r.querySelectorAll('[data-cor]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
          });
          ao(r, '[data-acao=salvar]', async (b) => {
            const nome = campo.value.trim().replace(/\s+/g, ' ');
            if (!nome) {
              erro.hidden = false;
              campo.focus();
              A.voz.falar('Escreva o nome.');
              return;
            }
            b.disabled = true;
            const pessoa = {
              id: A.db.novoId('pessoa'), nome, funcao: escolha.funcao, cor: escolha.cor, foto: escolha.foto,
              ativo: true, exemplo: false, criadoEm: new Date().toISOString(),
            };
            await A.db.salvar('pessoas', pessoa);
            await A.ir('quem');
            A.mostrarAviso(nome + ' cadastrado');
          });
        },
      };
    },

    // INÍCIO
    async inicio() {
      const p = A.estado.pessoa;
      const alertas = (await C().alertasEstoque()).slice(0, 2);
      const h = new Date().getHours();
      const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

      const cartaoAlerta = (a) => {
        const nome = a.insumo.nome.toUpperCase();
        let titulo;
        if (a.insumo.estoqueKg <= 0) titulo = `${nome}: ACABOU`;
        else if (a.dias !== null) titulo = `${nome}: ${a.dias} ${a.dias === 1 ? 'DIA' : 'DIAS'}`;
        else titulo = `${nome}: POUCO`;
        return `
  <div class="alerta ${a.nivel}">
    ${ic(a.nivel === 'vermelho' ? 'problema' : 'atencao', 48)}
    <div><b>${esc(titulo)}</b><span>Restam ${esc(C().sacosTexto(a.insumo.estoqueKg, a.insumo.kgPorSaco))}</span></div>
  </div>`;
      };
      const falaAlertas = alertas.map((a) => {
        if (a.insumo.estoqueKg <= 0) return `Atenção: acabou ${a.insumo.nome}.`;
        if (a.dias !== null) return `Atenção: ${a.insumo.nome} dá para ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}.`;
        return `Atenção: ${a.insumo.nome} está abaixo do mínimo.`;
      }).join(' ');

      return {
        fala: `${saudacao}, ${p.nome}. Para fazer uma mistura, toque no botão verde. ${falaAlertas}`,
        html: `
<main class="tela">
  <div class="topo">
    <button class="btn-pessoa" data-acao="trocar" aria-label="Trocar de pessoa (agora: ${esc(p.nome)})">${avatar(p, 64)}</button>
    <div class="saudacao">${saudacao},<br><b>${esc(p.nome)}</b></div>
    ${btnFalar()}
  </div>
  <button class="btn-principal" data-acao="misturar">${ic('misturar', 110, 1.6)}<span>FAZER MISTURA</span></button>
  <button class="btn-linha em-breve" data-acao="em-breve">${ic('caminhao', 56, 1.8)}<span>CHEGOU INSUMO<small>em breve</small></span></button>
  <button class="btn-linha vermelho em-breve" data-acao="em-breve">${ic('problema', 56)}<span>PROBLEMA<small>em breve</small></span></button>
  ${alertas.map(cartaoAlerta).join('')}
</main>`,
        ligar(r) {
          ao(r, '[data-acao=trocar]', () => A.ir('quem'));
          ao(r, '[data-acao=misturar]', () => A.ir('escolher'));
          ao(r, '[data-acao=em-breve]', () => {
            A.mostrarAviso('Esta parte ainda vai ser feita', 'laranja');
            A.voz.falar('Esta parte ainda vai ser feita.');
          });
        },
      };
    },

    // ESCOLHER O SAL
    async escolher() {
      const [formulas, insumos] = await Promise.all([A.db.todos('formulas'), A.db.todos('insumos')]);
      formulas.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      const mapa = porId(insumos);
      return {
        fala: formulas.length
          ? 'Qual sal você vai fazer? ' + formulas.map((f) => `${f.nome}, número ${f.numero}.`).join(' ')
          : 'Nenhum sal cadastrado.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">QUAL SAL?</h1>${btnFalar()}</div>
  ${formulas.map((f) => `
  <button class="cartao-sal" data-formula="${esc(f.id)}" style="--cor:${f.cor};--cor-clara:${f.corClara}">
    <span class="foto-sal">${f.foto ? `<img src="${f.foto}" alt="">` : ic('saco', 96, 1.4)}</span>
    <span class="faixa"><span>${esc(f.nome.toUpperCase())}</span><span class="numero">${f.numero}</span></span>
  </button>`).join('') || '<p class="vazio">Nenhum sal cadastrado.</p>'}
</main>`,
        ligar(r) {
          ao(r, '[data-acao=voltar]', () => A.ir('inicio'));
          ao(r, '[data-formula]', (b) => {
            const f = formulas.find((x) => x.id === b.dataset.formula);
            const faltas = C().faltas(f, mapa);
            A.estado.mistura = {
              formula: f, insumos: mapa, passo: 0, inicio: new Date().toISOString(),
              avisoFalta: faltas.length
                ? faltas.map((x) => ({ insumoId: x.insumo.id, precisaKg: x.precisaKg, temKg: x.temKg }))
                : null,
            };
            if (faltas.length) A.ir('aviso', { faltas });
            else A.ir('passo');
          });
        },
      };
    },

    // AVISO: FALTA INSUMO
    async aviso({ faltas }) {
      const f = faltas[0];
      const ins = f.insumo;
      const outras = faltas.slice(1);
      const q = (kg) => C().sacos(kg, ins.kgPorSaco);
      const precisa = q(f.precisaKg);
      const tem = q(f.temKg);
      const caixa = (rotulo, kg, s, ruim) => `
    <div class="qtd${ruim ? ' ruim' : ''}">
      <span class="rot">${ruim ? ic('atencao', 20) : ''}${rotulo}</span>
      <span class="num">${s.sacos || C().numero(kg)}</span>
      <span class="un">${s.sacos ? (s.sacos === 1 ? 'saco' : 'sacos') + (s.resto ? ' + ' + C().numero(s.resto) + ' kg' : '') : 'kg'}</span>
    </div>`;
      return {
        fala: `Atenção. Falta ${ins.nome}. Precisa de ${C().sacosFala(f.precisaKg, ins.kgPorSaco)}. Tem ${f.temKg > 0 ? C().sacosFala(f.temKg, ins.kgPorSaco) : 'nada'}.` +
          (outras.length ? ` Também falta ${outras.map((o) => o.insumo.nome).join(' e ')}.` : '') +
          ' Toque em avisar o dono.',
        html: `
<main class="tela centro">
  <div class="topo">${btnVoltar()}<span class="espaco"></span>${btnFalar()}</div>
  <div class="circulo-alerta">${ic('atencao', 72, 2.2)}</div>
  <h1 class="titulo-falta">FALTA ${esc(ins.nome.toUpperCase())}</h1>
  ${fotoInsumo(ins, 150)}
  <div class="grade-qtd">
    ${caixa('PRECISA', f.precisaKg, precisa, false)}
    ${caixa('TEM', f.temKg, tem, true)}
  </div>
  ${outras.length ? `<p class="tambem">Também falta: ${outras.map((o) => esc(o.insumo.nome)).join(', ')}</p>` : ''}
  <div class="espaco"></div>
  <button class="btn escuro grande" data-acao="avisar" style="font-size:28px">${ic('mensagem', 40)} AVISAR O DONO</button>
  <button class="btn" data-acao="continuar">${ic('seguir', 30, 2.4)} TEM SIM, CONTINUAR</button>
</main>`,
        ligar(r) {
          ao(r, '[data-acao=voltar]', () => { A.estado.mistura = null; A.ir('escolher'); });
          ao(r, '[data-acao=continuar]', () => A.ir('passo'));
          ao(r, '[data-acao=avisar]', async (b) => {
            b.disabled = true;
            const m = A.estado.mistura;
            const p = A.estado.pessoa;
            await A.db.salvar('problemas', {
              id: A.db.novoId('problema'), tipo: 'faltou-insumo', quando: new Date().toISOString(),
              formulaId: m.formula.id, formulaNome: m.formula.nome,
              faltas: faltas.map((x) => ({ insumoId: x.insumo.id, nome: x.insumo.nome, precisaKg: x.precisaKg, temKg: x.temKg })),
              pessoaId: p.id, pessoaNome: p.nome, exemplo: false,
            });
            A.estado.mistura = null;
            await A.ir('inicio');
            A.mostrarAviso('Aviso guardado para o dono');
            A.voz.falar('Pronto. O aviso ficou guardado para o dono.');
          });
        },
      };
    },

    // PASSO A PASSO DA MISTURA
    async passo() {
      const m = A.estado.mistura;
      const itens = m.formula.itens;
      const i = m.passo;
      const it = itens[i];
      const ins = m.insumos[it.insumoId];
      const s = C().sacos(it.kg, ins.kgPorSaco);

      const minis = itens.map((x, k) => {
        const insk = m.insumos[x.insumoId];
        const estado = k < i ? 'feito' : k === i ? 'agora' : 'depois';
        const leitura = estado === 'feito' ? 'feito' : estado === 'agora' ? 'agora' : 'depois';
        return `<div class="mini ${estado}" role="listitem" aria-label="${esc(insk.nome)}: ${leitura}" style="background:${insk.cor};color:${insk.corTexto}">
          ${estado === 'feito' ? ic('certo', 30, 3) : ic('saco', 26, 1.8)}<span>${esc(insk.nome.split(' ')[0])}</span></div>`;
      }).join('');

      const grande = s.sacos
        ? `<span class="qtd-num">${s.sacos}</span><span class="qtd-un">${s.sacos === 1 ? 'SACO' : 'SACOS'}</span>${s.resto ? `<span class="qtd-mais">+ ${C().numero(s.resto)} kg</span>` : ''}`
        : `<span class="qtd-num">${C().numero(it.kg)}</span><span class="qtd-un">KG</span>`;

      return {
        fala: `Passo ${i + 1} de ${itens.length}. Coloque ${C().sacosFala(it.kg, ins.kgPorSaco)} de ${ins.nome}. ` +
          `${s.sacos ? 'São ' + C().numero(it.kg) + ' quilos. ' : ''}Depois toque em feito.`,
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<div class="contador-passo">${i + 1} <small>de</small> ${itens.length}</div>${btnFalar()}</div>
  <div class="minis" role="list" aria-label="Insumos da batida" style="grid-template-columns:repeat(${itens.length}, minmax(0, 1fr))">${minis}</div>
  ${fotoInsumo(ins, 160)}
  <div class="nome-insumo">${esc(ins.nome.toUpperCase())}</div>
  <div class="quantidade">${grande}${s.sacos ? `<span class="qtd-kg">= ${C().numero(it.kg)} kg</span>` : ''}</div>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="feito">${ic('certo', 56, 3)} FEITO</button>
</main>`,
        ligar(r) {
          ao(r, '[data-acao=voltar]', () => {
            if (m.passo > 0) { m.passo--; A.ir('passo'); } else { A.estado.mistura = null; A.ir('escolher'); }
          });
          ao(r, '[data-acao=feito]', () => {
            m.passo++;
            A.ir(m.passo >= itens.length ? 'destino' : 'passo');
          });
        },
      };
    },

    // PARA ONDE VAI O SAL
    async destino() {
      const pastos = (await A.db.todos('pastos')).sort((a, b) => a.numero - b.numero);
      return {
        fala: 'Para onde vai o sal? Toque no pasto. ' +
          pastos.map((p) => `Pasto ${p.numero}, ${p.nome}.`).join(' ') + ' Ou toque em guardar no depósito.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">PARA ONDE VAI?</h1>${btnFalar()}</div>
  <div class="grade-pastos">
    ${pastos.map((p) => `
    <button class="cartao-pasto" data-pasto="${esc(p.id)}" style="--cor:${p.cor};--cor-clara:${p.corClara}" aria-label="Pasto ${p.numero}, ${esc(p.nome)}">
      <span class="foto-pasto">${p.foto ? `<img src="${p.foto}" alt="">` : ic('pasto', 60, 1.6)}</span>
      <span class="faixa-pasto"><span class="num">${p.numero}</span><span class="nome">${esc(p.nome)}</span></span>
    </button>`).join('')}
  </div>
  <button class="btn" data-acao="deposito">${ic('deposito', 34)} GUARDAR NO DEPÓSITO</button>
</main>`,
        ligar(r) {
          let salvando = false;
          const concluir = async (destino) => {
            if (salvando) return;
            salvando = true;
            r.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            const m = A.estado.mistura;
            const reg = C().montarMistura({
              formula: m.formula, insumosPorId: m.insumos, destino, pessoa: A.estado.pessoa,
              inicio: m.inicio, fim: new Date().toISOString(),
            });
            reg.avisoFalta = m.avisoFalta;
            try {
              await C().salvarMistura(reg);
            } catch (e) {
              salvando = false;
              r.querySelectorAll('button').forEach((b) => { b.disabled = false; });
              A.mostrarAviso('Não salvou. Tente de novo.', 'laranja');
              return;
            }
            A.estado.mistura = null;
            A.ir('pronta', { mistura: reg });
          };
          ao(r, '[data-acao=voltar]', () => {
            const m = A.estado.mistura;
            m.passo = m.formula.itens.length - 1;
            A.ir('passo');
          });
          ao(r, '[data-pasto]', (b) => {
            const p = pastos.find((x) => x.id === b.dataset.pasto);
            concluir({ tipo: 'pasto', id: p.id, numero: p.numero, nome: p.nome });
          });
          ao(r, '[data-acao=deposito]', () => concluir({ tipo: 'deposito', nome: 'Depósito' }));
        },
      };
    },

    // MISTURA PRONTA
    async pronta({ mistura }) {
      const p = A.estado.pessoa;
      const d = mistura.destino;
      const destinoFala = d.tipo === 'deposito' ? 'o depósito' : `o pasto ${d.numero}, ${d.nome}`;
      return {
        tom: 'verde',
        fala: `Mistura pronta. ${C().numero(mistura.totalKg)} quilos de ${mistura.formulaNome}, para ${destinoFala}. Obrigado, ${p.nome}.`,
        html: `
<main class="tela verde">
  <div class="topo"><span class="vago"></span><span class="espaco"></span>${btnFalar()}</div>
  <div class="circulo-ok">${ic('certo', 110, 3)}</div>
  <h1 class="titulo-pronta">MISTURA PRONTA</h1>
  <div class="bloco-verde total">
    <span class="num">${C().numero(mistura.totalKg)}</span>
    <span class="un">KG DE ${esc(mistura.formulaNome.toUpperCase())}</span>
  </div>
  <div class="bloco-verde linha-info">${ic(d.tipo === 'deposito' ? 'deposito' : 'pasto', 40)}<div><small>Destino</small><b>${esc(textoDestino(d))}</b></div></div>
  <div class="bloco-verde linha-info">${avatar(p, 48)}<div><small>Quem fez · quando</small><b>${esc(p.nome)} · ${esc(C().quando(mistura.fim))}</b></div></div>
  <div class="espaco"></div>
  <button class="btn branco-no-verde" data-acao="inicio">${ic('casa', 44, 2.4)} INÍCIO</button>
</main>`,
        ligar(r) {
          ao(r, '[data-acao=inicio]', () => A.ir('inicio'));
        },
      };
    },

    // ÁREA DO DONO (provisória: para conferir o que ficou salvo no celular)
    async dono() {
      const [misturas, insumos, problemas] = await Promise.all([
        A.db.todos('misturas'), A.db.todos('insumos'), A.db.todos('problemas'),
      ]);
      misturas.sort((a, b) => b.fim.localeCompare(a.fim));
      problemas.sort((a, b) => b.quando.localeCompare(a.quando));
      const exemplos = misturas.filter((m) => m.exemplo).length;
      const etq = (x) => (x.exemplo ? ' <span class="etiqueta">exemplo</span>' : '');
      return {
        fala: 'Área do dono. Aqui aparecem as misturas guardadas neste celular.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">ÁREA DO DONO</h1>${btnFalar()}</div>
  <section class="secao">
    <h2>Misturas guardadas neste celular: ${misturas.length}</h2>
    <p>${misturas.length - exemplos} ${misturas.length - exemplos === 1 ? "feita" : "feitas"} no app · ${exemplos} de exemplo</p>
    <ul class="lista">
      ${misturas.slice(0, 10).map((m) => `<li><b>${esc(C().quando(m.fim))}</b> · ${esc(m.formulaNome)} · ${C().numero(m.totalKg)} kg<br>
        ${esc(textoDestino(m.destino))} · ${esc(m.pessoaNome || '—')}${m.avisoFalta ? ' · <span class="etiqueta">feita com aviso de falta</span>' : ''}${etq(m)}</li>`).join('')}
    </ul>
  </section>
  <section class="secao">
    <h2>Estoque estimado</h2>
    <ul class="lista">
      ${insumos.map((i) => `<li><b>${esc(i.nome)}</b>: ${C().numero(i.estoqueKg)} kg (${esc(C().sacosTexto(i.estoqueKg, i.kgPorSaco))})${etq(i)}</li>`).join('')}
    </ul>
  </section>
  <section class="secao">
    <h2>Avisos de falta: ${problemas.length}</h2>
    <ul class="lista">
      ${problemas.slice(0, 5).map((p) => `<li><b>${esc(C().quando(p.quando))}</b> · ${esc(p.pessoaNome)} · falta ${esc((p.faltas || []).map((f) => f.nome).join(', '))} para ${esc(p.formulaNome)}</li>`).join('') || '<li>Nenhum.</li>'}
    </ul>
  </section>
  <button class="btn" data-acao="recomecar">Recomeçar demonstração</button>
  <button class="btn vermelho" data-acao="apagar-exemplos">${ic('problema', 28)} Apagar dados de exemplo</button>
</main>`,
        ligar(r) {
          ao(r, '[data-acao=voltar]', () => A.ir(A.estado.pessoa ? 'inicio' : 'quem'));
          ao(r, '[data-acao=recomecar]', async () => {
            if (!confirm('Apagar TUDO deste celular (inclusive pessoas e misturas feitas) e colocar os exemplos de novo?')) return;
            await A.exemplo.recomecar();
            A.estado.pessoa = null;
            A.ir('quem');
          });
          ao(r, '[data-acao=apagar-exemplos]', async () => {
            if (!confirm('Apagar os dados de exemplo? O que foi cadastrado de verdade continua.')) return;
            await A.exemplo.apagar();
            if (A.estado.pessoa && A.estado.pessoa.exemplo) A.estado.pessoa = null;
            await A.ir('dono');
            A.mostrarAviso('Exemplos apagados');
          });
        },
      };
    },
  };

  // Reduz a foto para não ocupar muito espaço no celular (quadrada, cortada no centro)
  function reduzirFoto(arquivo, lado) {
    return new Promise((ok, erro) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const menor = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - menor) / 2;
        const sy = (img.naturalHeight - menor) / 2;
        const tela = document.createElement('canvas');
        tela.width = lado;
        tela.height = lado;
        tela.getContext('2d').drawImage(img, sx, sy, menor, menor, 0, 0, lado, lado);
        URL.revokeObjectURL(url);
        ok(tela.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('foto')); };
      img.src = url;
    });
  }

  A.ui = { esc, ic };
})();
