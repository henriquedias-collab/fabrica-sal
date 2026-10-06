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
    menos: '<path d="M5 12h14"/>',
    microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
    parar: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    tocar: '<path d="M7 5v14l12-7z"/>',
    lixo: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    rasgado: '<path d="M8.5 3h7l-1.5 3.2c3 1.4 5 4.4 5 8.3 0 4.2-3 6.5-7 6.5s-7-2.3-7-6.5c0-3.9 2-6.9 5-8.3L8.5 3z"/><path d="M7.5 13l2 2 2.5-2.5 2.5 2.5 2-2"/>',
    gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    maquina: '<rect x="3" y="8" width="14" height="9" rx="2"/><path d="M17 11h3v3h-3"/><circle cx="7" cy="19.5" r="1.5"/><circle cx="13" cy="19.5" r="1.5"/><path d="M8 3l4 4M12 3 8 7"/>',
    vazio: '<path d="M8.5 3h7l-1.5 3.2c3 1.4 5 4.4 5 8.3 0 4.2-3 6.5-7 6.5s-7-2.3-7-6.5c0-3.9 2-6.9 5-8.3L8.5 3z"/><path d="M9.5 14h5"/>',
    desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    nuvem: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7z"/><path d="M12 11v6"/><path d="M9.5 13.5 12 11l2.5 2.5"/>',
    baixar: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M4 20h16"/>',
    grafico: '<path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/>',
    pausa: '<path d="M9 5v14"/><path d="M15 5v14"/>',
    abrir: '<path d="M12 16V5"/><path d="M7 9.5l5-5 5 5"/><path d="M4 20h16"/>',
  };

  function ic(nome, tam, traco) {
    return `<svg width="${tam || 28}" height="${tam || 28}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${traco || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;
  }

  // Ícone pequeno + nome do app, no alto da tela inicial e da Área do dono
  function marca() {
    return '<div class="marca"><img src="icones/icone.svg" alt="" width="30" height="30"><span>Cocho</span></div>';
  }

  // Desenho do cocho do ícone (sal + cocho + pés), na cor pedida. Usado no FAZER MISTURA e na Mistura pronta.
  function desenhoCocho(tam, cor) {
    return `<svg width="${tam}" height="${Math.round(tam * 0.62)}" viewBox="14 28 72 59" aria-hidden="true" fill="${cor}">` +
      '<path d="M28 58 Q50 30 72 58 Z" opacity="0.75"/><path d="M16 57h68l-8 19H24z"/>' +
      `<path d="M26 76v8M74 76v8" stroke="${cor}" stroke-width="5" stroke-linecap="round"/></svg>`;
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
    if (!d || d.tipo === 'nenhum') return 'Sem destino (encerrada pelo dono)';
    return d.tipo === 'deposito' ? 'Depósito' : `Pasto ${d.numero} · ${d.nome}`;
  }

  // Continua a mistura que ficou pela metade (guardada no celular)
  async function continuarMistura() {
    const m = await C().carregarAndamento();
    if (!m) return A.ir('inicio');
    if (m.faltaInsumo) {
      A.mostrarAviso('Esta mistura usa um insumo que foi apagado. Peça ao dono para encerrar.', 'laranja');
      return;
    }
    A.estado.mistura = m;
    await A.ir('passo');
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

    // CADASTRO DE PESSOA (nova ou, vindo da Área do dono, editar: { id, volta })
    async novaPessoa({ id, volta }) {
      const cores = ['#1d6b3a', '#1f4fa0', '#a65300', '#5b3a8a', '#0f6b6b', '#8c2257'];
      const atual = id ? await A.db.pegar('pessoas', id) : null;
      const escolha = atual
        ? { cor: atual.cor, funcao: atual.funcao || 'operador', foto: atual.foto || null }
        : { cor: cores[0], funcao: 'operador', foto: null };
      const corOk = cores.includes(escolha.cor) ? escolha.cor : cores[0];
      escolha.cor = corOk;
      const destinoVolta = volta || 'quem';
      return {
        fala: atual
          ? 'Editar pessoa. Mude o que precisar e toque em salvar.'
          : 'Cadastro de pessoa. Tire a foto, escreva o nome, escolha a cor e toque em salvar.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">${atual ? 'EDITAR PESSOA' : 'NOVA PESSOA'}</h1>${btnFalar()}</div>
  <button class="foto-pessoa${escolha.foto ? ' com-foto' : ''}" data-acao="foto" aria-label="Tirar foto">${escolha.foto
    ? `<img src="${escolha.foto}" alt="Foto atual">`
    : `${ic('camera', 56, 1.8)}<span>TIRAR FOTO</span>`}</button>
  <input type="file" accept="image/*" capture="user" id="arquivo-foto" hidden>
  <label class="rotulo" for="nome-pessoa">Nome</label>
  <input id="nome-pessoa" class="campo" type="text" autocomplete="off" autocapitalize="words" maxlength="30" placeholder="Ex.: João" value="${esc(atual ? atual.nome : '')}">
  <div class="rotulo">Função</div>
  <div class="grade-2">
    <button class="opcao" data-funcao="operador" aria-pressed="${escolha.funcao !== 'dono'}">${ic('pessoa', 28)} OPERADOR</button>
    <button class="opcao" data-funcao="dono" aria-pressed="${escolha.funcao === 'dono'}">${ic('chave', 28)} DONO</button>
  </div>
  <div class="rotulo">Cor</div>
  <div class="cores">
    ${cores.map((c, k) => `<button class="cor" data-cor="${c}" style="background:${c}" aria-label="Cor ${k + 1}" aria-pressed="${c === escolha.cor}">${ic('certo', 26, 3)}</button>`).join('')}
  </div>
  <p class="erro" role="alert" hidden>${ic('atencao', 28)} <span>Escreva o nome.</span></p>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${atual ? `<button class="btn" data-acao="remover">${ic('problema', 28)} Tirar da lista "Quem é você?"</button>` : ''}
</main>`,
        ligar(r) {
          const arquivo = r.querySelector('#arquivo-foto');
          const btnFoto = r.querySelector('[data-acao=foto]');
          const campo = r.querySelector('#nome-pessoa');
          const erro = r.querySelector('.erro');

          ao(r, '[data-acao=voltar]', () => A.ir(destinoVolta));
          ao(r, '[data-acao=remover]', async () => {
            if (!confirm(`Tirar ${atual.nome} da lista? As misturas já feitas por ${atual.nome} continuam no histórico.`)) return;
            await A.db.salvar('pessoas', Object.assign({}, atual, { ativo: false }));
            if (A.estado.pessoa && A.estado.pessoa.id === atual.id) {
              A.estado.pessoa = null;
              await A.db.apagar('config', 'pessoaAtual');
            }
            await A.ir(destinoVolta);
            A.mostrarAviso(atual.nome + ' saiu da lista');
          });
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
            const pessoa = Object.assign(
              atual || { id: A.db.novoId('pessoa'), ativo: true, exemplo: false, criadoEm: new Date().toISOString() },
              { nome, funcao: escolha.funcao, cor: escolha.cor, foto: escolha.foto, exemplo: false },
            );
            await A.db.salvar('pessoas', pessoa);
            if (A.estado.pessoa && A.estado.pessoa.id === pessoa.id) A.estado.pessoa = pessoa;
            await A.ir(destinoVolta);
            A.mostrarAviso(nome + (atual ? ' atualizado' : ' cadastrado'));
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
    <div><b>${esc(titulo)}</b><span>Restam ${esc(C().qtdTexto(a.insumo.estoqueKg, a.insumo))}</span></div>
  </div>`;
      };
      const falaAlertas = alertas.map((a) => {
        if (a.insumo.estoqueKg <= 0) return `Atenção: acabou ${a.insumo.nome}.`;
        if (a.dias !== null) return `Atenção: ${a.insumo.nome} dá para ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}.`;
        return `Atenção: ${a.insumo.nome} está abaixo do mínimo.`;
      }).join(' ');

      // Mistura pela metade (pausada, ou o app fechou no meio)
      const parada = await C().carregarAndamento();
      const falta = parada ? C().faltando(parada) : [];
      const cartaoParada = parada ? `
  <button class="alerta laranja cartao-continuar" data-acao="continuar">${ic('atencao', 52, 2.4)}<div>
    <b>MISTURA PELA METADE</b><strong>CONTINUAR</strong>
    <span>${esc(parada.formula.nome)}${falta.length ? ' · falta: ' + falta.map((x) => `${esc(x.nome)} ${esc(x.texto)}`).join(', ') : ' · falta escolher o destino'}</span></div></button>` : '';
      const falaParada = parada
        ? `Tem uma mistura de ${parada.formula.nome} pela metade. Para continuar, toque no botão amarelo de cima. `
        : '';

      return {
        fala: `${saudacao}, ${p.nome}. ${falaParada}Para fazer uma mistura, toque no botão grande com o cocho. Se chegou insumo, toque no caminhão. Se deu problema, toque no botão vermelho. ${falaAlertas}`,
        html: `
<main class="tela">
  <div class="topo">${marca()}${btnFalar()}</div>
  <div class="linha-saudacao">
    <button class="btn-pessoa" data-acao="trocar" aria-label="Trocar de pessoa (agora: ${esc(p.nome)})">${avatar(p, 60)}</button>
    <div class="saudacao">${saudacao},<br><b>${esc(p.nome)}</b></div>
  </div>
  ${cartaoParada}
  <button class="btn-principal" data-acao="misturar">${desenhoCocho(180, '#ffffff')}<span>FAZER MISTURA</span></button>
  <button class="btn-linha" data-acao="chegada">${ic('caminhao', 56, 1.8)}<span>CHEGOU INSUMO</span></button>
  <button class="btn-linha vermelho" data-acao="problema">${ic('problema', 56)}<span>PROBLEMA</span></button>
  ${alertas.map(cartaoAlerta).join('')}
</main>`,
        ligar(r) {
          ao(r, '[data-acao=trocar]', () => A.ir('quem'));
          ao(r, '[data-acao=continuar]', () => continuarMistura());
          ao(r, '[data-acao=misturar]', async () => {
            if (!parada) return A.ir('escolher');
            // Uma mistura por vez: primeiro termina a que está pela metade
            await continuarMistura();
            A.mostrarAviso('Primeiro termine a mistura que está pela metade');
            A.voz.falar('Primeiro termine a mistura que está pela metade.');
          });
          ao(r, '[data-acao=chegada]', () => A.ir('chegada'));
          ao(r, '[data-acao=problema]', () => A.ir('problema'));
          ao(r, '[data-acao=em-breve]', () => {
            A.mostrarAviso('Esta parte ainda vai ser feita', 'laranja');
            A.voz.falar('Esta parte ainda vai ser feita.');
          });
        },
      };
    },

    // ESCOLHER O SAL
    async escolher() {
      const [todasFormulas, insumos] = await Promise.all([A.db.todos('formulas'), A.db.todos('insumos')]);
      const mapa = porId(insumos);
      // Só aparecem fórmulas completas (com todos os insumos cadastrados)
      const formulas = todasFormulas
        .filter((f) => f.itens.length && f.itens.every((it) => mapa[it.insumoId]))
        .sort((a, b) => (a.numero || 0) - (b.numero || 0));
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
            // Só fica guardada no celular depois do 1º saco (antes disso, voltar não deixa rastro)
            A.estado.mistura = C().novaMistura({
              formula: f, insumosPorId: mapa, pessoa: A.estado.pessoa,
              avisoFalta: faltas.length
                ? faltas.map((x) => ({ insumoId: x.insumo.id, precisaKg: x.precisaKg, temKg: x.temKg }))
                : null,
            });
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
      const q = (kg) => C().qtd(kg, ins);
      const precisa = q(f.precisaKg);
      const tem = q(f.temKg);
      const caixa = (rotulo, kg, s, ruim) => `
    <div class="qtd${ruim ? ' ruim' : ''}">
      <span class="rot">${ruim ? ic('atencao', 20) : ''}${rotulo}</span>
      <span class="num">${s.n || C().numero(kg)}</span>
      <span class="un">${s.n ? C().nomeUnidade(s.n, ins) + (s.resto ? ' + ' + C().numero(s.resto) + ' kg' : '') : 'kg'}</span>
    </div>`;
      return {
        fala: `Atenção. Falta ${ins.nome}. Precisa de ${C().qtdFala(f.precisaKg, ins)}. Tem ${f.temKg > 0 ? C().qtdFala(f.temKg, ins) : 'nada'}.` +
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

    // PASSO A PASSO DA MISTURA: saco por saco, em qualquer ordem.
    // Cada toque grava o progresso no celular e baixa o estoque do que foi colocado (ver calculos.js).
    async passo() {
      const m = A.estado.mistura;
      const itens = m.formula.itens;
      if (m.atual === undefined || !itens[m.atual]) m.atual = 0;
      const i = m.atual;
      const it = itens[i];
      const ins = m.insumos[it.insumoId];
      const progs = itens.map((_, k) => C().progresso(m, k));
      const p = progs[i];
      const nFeitos = progs.filter((x) => x.completo).length;
      const tudoFeito = nFeitos === itens.length;
      const algoColocado = progs.some((x) => x.kg > 0);
      const falaAuto = (await A.db.config('falaContagem')) !== false;
      const soKg = p.n === 0; // a granel (ou menos de 1 saco): FEITO com os kg
      const faseResto = !soKg && p.unid >= p.n && p.resto > 0 && !p.restoFeito; // sacos prontos, falta a sobra em kg
      const um = C().unidade(ins).um.toUpperCase(); // SACO, BALDE, BAG
      const faltamUn = p.n - p.unid;
      const nomeUn = (q) => C().nomeUnidade(q, ins);

      const minis = itens.map((x, k) => {
        const insk = m.insumos[x.insumoId];
        const pk = progs[k];
        const classes = ['mini', pk.completo ? 'feito' : 'falta', k === i ? 'agora' : ''].join(' ');
        const texto = pk.completo ? 'pronto' : pk.n ? `${pk.unid}/${pk.n}` : `${C().numero(pk.resto)} kg`;
        return `<button class="${classes}" data-item="${k}" aria-pressed="${k === i}" aria-label="${esc(insk.nome)}: ${pk.completo ? 'completo' : texto}"
          style="background:${insk.cor};color:${insk.corTexto}">
          ${pk.completo ? ic('certo', 26, 3) : ic('saco', 22, 1.8)}<span>${esc(insk.nome.split(' ')[0])}</span><b class="prog">${pk.completo ? 'OK' : texto}</b></button>`;
      }).join('');

      // Número gigante: "6 / 14" + unidade; a granel, os kg
      const contador = soKg
        ? `<div class="contagem-sacos"><span class="feitos-num">${C().numero(p.resto)}</span></div><span class="qtd-un">KG</span>`
        : `<div class="contagem-sacos" aria-label="${p.unid} de ${p.n} ${nomeUn(p.n)}"><span class="feitos-num">${p.unid}</span><span class="de-total">/ ${p.n}</span></div>
           <span class="qtd-un">${nomeUn(p.n).toUpperCase()}</span>
           ${p.resto > 0 ? `<span class="qtd-mais${p.restoFeito ? ' ok' : ''}">${p.restoFeito ? ic('certo', 24, 3) : ''} + ${C().numero(p.resto)} kg</span>` : ''}`;

      let situacao;
      if (p.completo) situacao = `<div class="selo-feito">${ic('certo', 30, 3)} COMPLETO</div>`;
      else if (soKg) situacao = '';
      else if (faseResto) situacao = `<div class="falta-pilula">FALTAM ${C().numero(p.resto)} kg</div>`;
      else situacao = `<div class="falta-pilula">FALTA${faltamUn === 1 ? '' : 'M'} ${faltamUn}</div>`;

      // Fileira de saquinhos (até 20); mais que isso, barra de progresso
      let fileira = '';
      if (p.n > 0 && p.n <= 20) {
        fileira = `<div class="fileira-sacos" aria-hidden="true">${Array.from({ length: p.n }, (_, k) =>
          `<span class="saquinho${k < p.unid ? ' cheio' : ''}">${ic('saco', 26, 2)}</span>`).join('')}</div>`;
      } else if (p.n > 20) {
        fileira = `<div class="barra barra-sacos" aria-hidden="true"><span class="verde" style="width:${Math.round((p.unid / p.n) * 100)}%"></span></div>`;
      }

      // Botões
      let botoes;
      if (p.completo) {
        botoes = tudoFeito
          ? `<button class="btn verde grande" data-acao="seguir">${ic('seguir', 48, 2.6)} SEGUIR</button>`
          : `<button class="btn verde grande" data-acao="proximo">${ic('seguir', 48, 2.6)} PRÓXIMO</button>`;
        botoes += soKg
          ? `<button class="btn laranja" data-acao="menos">${ic('desfazer', 30, 2.6)} DESFAZER</button>`
          : `<button class="btn laranja" data-acao="menos">${ic('menos', 30, 3)} −1 (CORRIGIR)</button>`;
      } else if (soKg) {
        botoes = `<button class="btn verde grande" data-acao="resto">${ic('certo', 56, 3)} FEITO</button>`;
      } else if (faseResto) {
        botoes = `
  <div class="linha-contar">
    <button class="btn btn-menos" data-acao="menos" aria-label="Menos um ${C().unidade(ins).um}">−1</button>
    <button class="btn terra grande" data-acao="resto">${ic('mais', 40, 3)} ${C().numero(p.resto)} kg</button>
  </div>`;
      } else {
        botoes = `
  <div class="linha-contar">
    <button class="btn btn-menos" data-acao="menos" aria-label="Menos um ${C().unidade(ins).um}" ${p.unid === 0 ? 'disabled' : ''}>−1</button>
    <button class="btn terra grande" data-acao="mais">+1 ${um}</button>
  </div>
  <button class="btn" data-acao="todos">${ic('certo', 30, 3)} COLOQUEI TODOS</button>`;
      }

      const contagem = `${nFeitos} de ${itens.length} ${nFeitos === 1 ? 'feito' : 'feitos'}`;
      let fala;
      if (tudoFeito) fala = 'Todos os insumos foram colocados. Toque em seguir.';
      else if (p.completo) fala = `${ins.nome} está completo. Toque em próximo. Se contou errado, toque em menos um.`;
      else if (soKg) fala = `${contagem}. Coloque ${C().numero(p.resto)} quilos de ${ins.nome}. Depois toque em feito.`;
      else if (faseResto) fala = `Os ${nomeUn(p.n)} de ${ins.nome} estão completos. Agora coloque mais ${C().numero(p.resto)} quilos e toque no botão.`;
      else fala = `${contagem}. ${ins.nome}: coloque ${C().qtdFala(it.kg, ins)}. Já colocou ${p.unid}. Faltam ${faltamUn}. ` +
        `A cada ${C().unidade(ins).um} colocado, toque em mais um. Pode fazer na ordem que quiser: toque no insumo lá em cima.`;

      return {
        fala,
        html: `
<main class="tela tela-passo">
  <div class="topo">${btnVoltar()}<div class="contador-passo"><span class="pilula"><b>${nFeitos}</b> de <b>${itens.length}</b> ${nFeitos === 1 ? 'feito' : 'feitos'}</span></div>${btnFalar()}</div>
  <div class="minis" role="group" aria-label="Insumos da batida (toque para escolher)" style="grid-template-columns:repeat(${itens.length}, minmax(0, 1fr))">${minis}</div>
  <div class="cartao-passo">
    <div class="cabeca-insumo">${fotoInsumo(ins, 84)}
    <div class="nome-insumo">${esc(ins.nome.toUpperCase())}</div></div>
    <div class="quantidade" aria-live="polite">${contador}</div>
    ${situacao}
    ${fileira}
    <span class="qtd-kg">${C().numero(p.kg)} de ${C().numero(p.kgAlvo)} kg</span>
  </div>
  <div class="espaco"></div>
  ${botoes}
  <div class="rodape-passo">
    ${algoColocado ? `<button class="btn" data-acao="pausar">${ic('pausa', 28, 2.6)} PAUSAR</button>` : ''}
    <button class="btn btn-fala-auto" data-acao="fala-auto" aria-pressed="${falaAuto}" aria-label="Falar a contagem a cada toque: ${falaAuto ? 'ligado' : 'desligado'}">
      ${ic('som', 28, 2.2)} ${falaAuto ? 'FALA: SIM' : 'FALA: NÃO'}</button>
  </div>
</main>`,
        ligar(r) {
          const proximoQueFalta = () => itens.map((_, k) => (i + 1 + k) % itens.length).find((k) => !C().progresso(m, k).completo);

          // Muda a contagem deste insumo, grava (com o estoque) e mostra/fala o resultado
          const mudar = async (novo) => {
            if (A.estado.gravando) return; // toque rápido demais: espera a gravação anterior
            A.estado.gravando = true;
            const antes = C().progresso(m, i);
            const velho = m.colocado[i];
            const velhaOrdem = m.ordem.slice();
            const velhoAtual = m.atual;
            m.colocado[i] = novo;
            const depois = C().progresso(m, i);
            const quando = new Date().toISOString();
            if (!antes.completo && depois.completo) m.ordem.push({ insumoId: it.insumoId, quando });
            if (antes.completo && !depois.completo) {
              const pos = m.ordem.map((o) => o.insumoId).lastIndexOf(it.insumoId);
              if (pos >= 0) m.ordem.splice(pos, 1);
            }
            const completou = !antes.completo && depois.completo;
            const prox = completou ? proximoQueFalta() : undefined;
            if (completou && prox !== undefined) m.atual = prox;
            try {
              await C().gravarAndamento(m, { [it.insumoId]: depois.kg - antes.kg });
            } catch (e) {
              console.error(e);
              m.colocado[i] = velho;
              m.ordem = velhaOrdem;
              m.atual = velhoAtual;
              A.estado.gravando = false;
              A.mostrarAviso('Não guardou. Toque de novo.', 'laranja');
              return;
            }
            A.estado.gravando = false;
            let curta;
            if (completou && prox === undefined) {
              await A.ir('destino');
              curta = `${ins.nome} completo. Tudo colocado. Para onde vai o sal?`;
            } else if (completou) {
              await A.ir('passo');
              const insP = m.insumos[itens[prox].insumoId];
              A.mostrarAviso(`${ins.nome}: completo`);
              curta = `${ins.nome} completo. Agora ${insP.nome}: ${C().qtdFala(itens[prox].kg, insP)}.`;
            } else {
              await A.ir('passo');
              if (depois.n > 0 && depois.unid >= depois.n && depois.resto > 0 && !depois.restoFeito) {
                curta = `${depois.n} de ${depois.n}. Agora mais ${C().numero(depois.resto)} quilos.`;
              } else if (depois.n > 0) {
                curta = `${depois.unid} de ${depois.n}. Falta${depois.n - depois.unid === 1 ? '' : 'm'} ${depois.n - depois.unid}.`;
              } else {
                curta = 'Desfeito.';
              }
            }
            if (falaAuto && curta) A.voz.falar(curta);
          };

          ao(r, '[data-acao=mais]', () => mudar({ unid: Math.min(p.n, p.unid + 1), resto: p.restoFeito }));
          ao(r, '[data-acao=resto]', () => mudar({ unid: p.n, resto: true }));
          ao(r, '[data-acao=todos]', () => mudar({ unid: p.n, resto: true }));
          ao(r, '[data-acao=menos]', () => {
            // −1 desfaz o último: primeiro a sobra em kg, depois um saco
            if (p.restoFeito) mudar({ unid: p.unid, resto: false });
            else if (p.unid > 0) mudar({ unid: p.unid - 1, resto: false });
          });
          ao(r, '[data-acao=proximo]', () => {
            const prox = proximoQueFalta();
            if (prox === undefined) return A.ir('destino');
            m.atual = prox;
            if (m.guardada) C().gravarAndamento(m, {}).catch(() => {});
            A.ir('passo');
          });
          ao(r, '[data-acao=seguir]', () => A.ir('destino'));
          ao(r, '[data-item]', (b) => {
            m.atual = Number(b.dataset.item);
            if (m.guardada) C().gravarAndamento(m, {}).catch(() => {});
            A.ir('passo');
          });
          ao(r, '[data-acao=fala-auto]', async () => {
            await A.db.definir('falaContagem', !falaAuto);
            await A.ir('passo');
            if (!falaAuto) A.voz.falar('A contagem vai ser falada a cada toque.');
            else A.mostrarAviso('Fala da contagem desligada');
          });
          ao(r, '[data-acao=pausar]', async () => {
            await C().gravarAndamento(m, {});
            A.estado.mistura = null;
            await A.ir('inicio');
            A.mostrarAviso('Mistura guardada. Continue quando quiser.');
            A.voz.falar('Mistura guardada. Para continuar, toque no botão amarelo.');
          });
          ao(r, '[data-acao=voltar]', async () => {
            if (!algoColocado) {
              // nada colocado ainda: sai sem registrar nada
              if (m.guardada) await C().apagarAndamento();
              A.estado.mistura = null;
              A.ir('escolher');
            } else A.ir('sairMistura');
          });
        },
      };
    },

    // SAIR NO MEIO DA MISTURA: já tem saco colocado, então a mistura não some — fica guardada (pausada)
    async sairMistura() {
      const m = A.estado.mistura;
      const kg = C().totalColocadoKg(m);
      return {
        fala: `Você já colocou ${C().numero(kg)} quilos nesta mistura. Para continuar, toque no botão verde. Para parar agora e continuar depois, toque em pausar.`,
        html: `
<main class="tela centro">
  <div class="topo"><span class="vago"></span><span class="espaco"></span>${btnFalar()}</div>
  <div class="circulo-alerta laranja">${ic('atencao', 72, 2.2)}</div>
  <h1 class="titulo-falta laranja">PARAR A MISTURA?</h1>
  <p class="instrucao">Já colocou <b>${C().numero(kg)} kg</b>. A mistura fica guardada e aparece no Início para continuar.</p>
  <div class="espaco"></div>
  <button class="btn verde grande" data-acao="continuar">${ic('seguir', 44, 2.6)} CONTINUAR</button>
  <button class="btn" data-acao="pausar">${ic('pausa', 30, 2.6)} PAUSAR E SAIR</button>
</main>`,
        ligar(r) {
          ao(r, '[data-acao=continuar]', () => A.ir('passo'));
          ao(r, '[data-acao=pausar]', async () => {
            await C().gravarAndamento(m, {});
            A.estado.mistura = null;
            await A.ir('inicio');
            A.mostrarAviso('Mistura guardada. Continue quando quiser.');
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
            let reg;
            try {
              // grava o que foi colocado de fato (o estoque já baixou saco por saco) e apaga o andamento
              reg = await C().concluirMistura(m, { destino, pessoa: A.estado.pessoa });
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
            m.atual = m.formula.itens.length - 1; // volta mostrando o último insumo (com −1 para corrigir)
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
    ${desenhoCocho(96, '#ffffff')}
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


    // REGISTROS (Área do dono): o que ficou guardado neste celular
    async registros() {
      const [misturas, insumos, problemas, entradas, contagens] = await Promise.all([
        A.db.todos('misturas'), A.db.todos('insumos'), A.db.todos('problemas'),
        A.db.todos('entradas'), A.db.todos('contagens'),
      ]);
      misturas.sort((a, b) => b.fim.localeCompare(a.fim));
      problemas.sort((a, b) => b.quando.localeCompare(a.quando));
      entradas.sort((a, b) => b.quando.localeCompare(a.quando));
      contagens.sort((a, b) => b.quando.localeCompare(a.quando));
      insumos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const exemplos = misturas.filter((m) => m.exemplo).length;
      const feitas = misturas.length - exemplos;
      const etq = (x) => (x.exemplo ? ' <span class="etiqueta">exemplo</span>' : '');
      const incompleta = (m) => (m.status === 'incompleta'
        ? ` <span class="etiqueta laranja">${ic('atencao', 16)} incompleta: ${C().numero(m.totalKg)} de ${C().numero(m.totalFormulaKg)} kg${m.encerradaPeloDono ? ', encerrada pelo dono' : ''}</span>`
        : '');

      // Mistura em andamento (pausada ou interrompida)
      const andamento = await C().carregarAndamento();
      let blocoAndamento = '';
      if (andamento) {
        const linhas = andamento.formula.itens.map((it, k) => {
          const pk = C().progresso(andamento, k);
          const ins = andamento.insumos[it.insumoId] || { nome: '(insumo apagado)' };
          const quanto = pk.n ? `${pk.unid} de ${pk.n} ${C().nomeUnidade(pk.n, ins)}${pk.resto > 0 ? ` + ${C().numero(pk.resto)} kg${pk.restoFeito ? ' (feito)' : ''}` : ''}` : `${C().numero(pk.resto)} kg${pk.restoFeito ? ' (feito)' : ''}`;
          return `<li>${pk.completo ? ic('certo', 18, 3) : ic('menos', 18, 3)} <b>${esc(ins.nome)}</b>: ${esc(quanto)} · ${C().numero(pk.kg)} de ${C().numero(pk.kgAlvo)} kg</li>`;
        }).join('');
        blocoAndamento = `
  <section class="secao em-andamento">
    <h2>${ic('atencao', 26)} Mistura em andamento</h2>
    <p><b>${esc(andamento.formula.nome)}</b> · ${esc(andamento.pessoaNome || '—')} · começou ${esc(C().quando(andamento.inicio))}${andamento.atualizadaEm ? ` · último toque ${esc(C().quando(andamento.atualizadaEm))}` : ''}</p>
    <ul class="lista">${linhas}</ul>
    <p>Colocado até agora: <b>${C().numero(C().totalColocadoKg(andamento))} kg</b> (já saiu do estoque).</p>
    <p class="ajuda">Se ela foi abandonada, encerre: fica registrado só o que foi colocado de verdade, sem destino.</p>
    <button class="btn vermelho" data-acao="encerrar">${ic('problema', 28)} ENCERRAR MISTURA</button>
  </section>`;
      }

      return {
        fala: andamento
          ? 'Registros. Tem uma mistura em andamento, logo no começo da tela.'
          : 'Registros. Aqui aparece o que ficou guardado neste celular.',
        html: `
<main class="tela">
  <div class="topo">${btnVoltar()}<h1 class="titulo">REGISTROS</h1>${btnFalar()}</div>
  ${blocoAndamento}
  ${entradas.some((e) => e.pesoDiferente) ? `<p class="aviso-dono">${ic('atencao', 24)} <span><b>${entradas.filter((e) => e.pesoDiferente).length} ${entradas.filter((e) => e.pesoDiferente).length === 1 ? 'chegada' : 'chegadas'} com saco de peso diferente do cadastro</b> (veja em Chegadas). O cadastro não foi mudado: se o peso mudou de vez, corrija em Insumos.</span></p>` : ''}
  <section class="secao">
    <h2>Misturas: ${misturas.length}</h2>
    <p>${feitas} ${feitas === 1 ? 'feita' : 'feitas'} no app · ${exemplos} de exemplo</p>
    <ul class="lista">
      ${misturas.slice(0, 10).map((m) => `<li><b>${esc(C().quando(m.fim))}</b> · ${esc(m.formulaNome)} · ${C().numero(m.totalKg)} kg<br>
        ${esc(textoDestino(m.destino))} · ${esc(m.pessoaNome || '—')}${m.avisoFalta ? ' · <span class="etiqueta">feita com aviso de falta</span>' : ''}${incompleta(m)}${etq(m)}</li>`).join('') || '<li>Nenhuma.</li>'}
    </ul>
  </section>
  <section class="secao">
    <h2>Chegadas de insumo: ${entradas.length}</h2>
    <ul class="lista">
      ${entradas.slice(0, 10).map((e) => `<li><b>${esc(C().quando(e.quando))}</b> · ${esc(e.insumoNome)} · ${esc(e.texto)}<br>
        Recebido por ${esc(e.pessoaNome || '—')}${e.pesoDiferente ? `<br><span class="etiqueta laranja">${ic('atencao', 16)} peso diferente: saco de ${C().numero(e.kgPorUnidade)} kg (cadastro: ${C().numero(e.kgPorUnidadeCadastro)} kg)</span>` : ''}</li>`).join('') || '<li>Nenhuma.</li>'}
    </ul>
  </section>
  <section class="secao">
    <h2>Problemas e avisos: ${problemas.length}</h2>
    <ul class="lista">
      ${problemas.slice(0, 10).map((p) => `<li><b>${esc(C().quando(p.quando))}</b> · ${esc(p.pessoaNome || '—')}<br>${esc(descreverProblema(p))} <span class="etiqueta${p.resolvidoEm ? '' : ' ruim'}">${p.resolvidoEm ? 'resolvido ' + esc(C().quando(p.resolvidoEm)) : 'aberto'}</span>${etq(p)}
        ${p.foto ? `<br><img class="foto-registro" src="${p.foto}" alt="Foto do problema">` : ''}
        ${p.audio ? `<br><audio controls preload="none" data-audio="${esc(p.id)}"></audio>` : ''}</li>`).join('') || '<li>Nenhum.</li>'}
    </ul>
  </section>
  <section class="secao">
    <h2>Estoque estimado</h2>
    <ul class="lista">
      ${insumos.map((i) => `<li><b>${esc(i.nome)}</b>: ${C().numero(i.estoqueKg)} kg (${esc(C().qtdTexto(i.estoqueKg, i))})${etq(i)}</li>`).join('') || '<li>Nenhum insumo.</li>'}
    </ul>
  </section>
  ${contagens.length ? `
  <section class="secao">
    <h2>Correções de estoque: ${contagens.length}</h2>
    <ul class="lista">
      ${contagens.slice(0, 10).map((c) => `<li><b>${esc(C().quando(c.quando))}</b> · ${esc(c.insumoNome)}: ${C().numero(c.antesKg)} kg → ${C().numero(c.depoisKg)} kg</li>`).join('')}
    </ul>
  </section>` : ''}
</main>`,
        ligar(r) {
          ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          ao(r, '[data-acao=encerrar]', async (b) => {
            const kg = C().totalColocadoKg(andamento);
            const pergunta = kg > 0
              ? `Encerrar a mistura de ${andamento.formula.nome}? Fica registrado só o que foi colocado (${C().numero(kg)} kg). O operador não vai mais poder continuar.`
              : `Encerrar a mistura de ${andamento.formula.nome}? Nada foi colocado, então ela só some.`;
            if (!confirm(pergunta)) return;
            b.disabled = true;
            try {
              if (kg > 0) await C().concluirMistura(andamento, { destino: { tipo: 'nenhum', nome: 'Sem destino' }, encerrada: true });
              else await C().apagarAndamento();
            } catch (e) {
              console.error(e);
              b.disabled = false;
              A.mostrarAviso('Não deu para encerrar. Tente de novo.', 'laranja');
              return;
            }
            A.estado.mistura = null;
            await A.ir('registros');
            A.mostrarAviso(kg > 0 ? 'Mistura encerrada e registrada' : 'Mistura apagada');
          });
          // O áudio fica guardado como arquivo no celular; liga cada player ao seu arquivo
          r.querySelectorAll('[data-audio]').forEach((el) => {
            const p = problemas.find((x) => x.id === el.dataset.audio);
            if (p && p.audio instanceof Blob) el.src = URL.createObjectURL(p.audio);
          });
        },
      };
    },
  };

  const NOMES_PROBLEMA = {
    'faltou-insumo': 'Faltou insumo',
    'saco-rasgado': 'Saco rasgado',
    molhado: 'Molhado',
    'maquina-parada': 'Máquina parada',
  };

  function descreverProblema(p) {
    const tipo = NOMES_PROBLEMA[p.tipo] || 'Problema';
    if (p.faltas && p.faltas.length) {
      return `${tipo}: ${p.faltas.map((f) => f.nome).join(', ')}${p.formulaNome ? ' (para ' + p.formulaNome + ')' : ''}`;
    }
    return p.insumoNome ? `${tipo}: ${p.insumoNome}` : tipo;
  }

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

  A.ui = { esc, ic, marca, desenhoCocho, btnFalar, btnVoltar, avatar, fotoInsumo, porId, ao, reduzirFoto, descreverProblema, NOMES_PROBLEMA };
})();
