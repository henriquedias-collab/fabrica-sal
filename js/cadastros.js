// Área do dono: senha, menu e cadastros (insumos, fórmulas, pastos, pessoas, dados de exemplo).
// As telas entram junto com as do operador em App.telas.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const U = () => App.ui;

  // Cores dos quadros dos insumos (fundo claro + texto escuro)
  const CORES_INSUMO = [
    ['#e9e7e1', '#3d3a33'], ['#dfe7f2', '#1f3f6e'], ['#e2d6ee', '#4b2f73'], ['#ecd3a2', '#6b4a12'],
    ['#d6e8dc', '#1d4d2e'], ['#f8e2c9', '#6b3500'], ['#d9eeee', '#0f4f4f'], ['#f3dbe7', '#6e1a45'],
  ];
  // Cores das fórmulas e pastos (forte + versão clara para o fundo da foto)
  const CORES_FORTES = [
    ['#1d6b3a', '#d6e8dc'], ['#1f4fa0', '#dbe5f5'], ['#a65300', '#f8e2c9'], ['#5b3a8a', '#e6dcf2'],
    ['#0f6b6b', '#d9eeee'], ['#8c2257', '#f3dbe7'], ['#4a4636', '#e4ded0'],
  ];
  const ROTULO_UNIDADE = { saco: 'SACO', balde: 'BALDE', bag: 'BAG', kg: 'A GRANEL (kg)' };

  // ---------- pedaços ----------

  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);

  function topo(titulo) {
    return `<div class="topo">${U().btnVoltar()}<h1 class="titulo">${titulo}</h1>${U().btnFalar()}</div>`;
  }

  // "12,5" ou "12.5" -> 12.5 ; "1.500" ou "1.500,5" -> 1500 / 1500.5 ; vazio ou inválido -> null
  function lerNumero(texto) {
    let t = String(texto || '').trim().replace(/\s/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // vírgula = decimal; pontos = milhar
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // "1.500" = mil e quinhentos
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  // 12.5 -> "12,5" para mostrar no campo
  function paraCampo(n) {
    if (n === null || n === undefined || n === '') return '';
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  function campoNumero(id, rotulo, valor, sufixo, ajuda) {
    return `
  <label class="rotulo" for="${id}">${rotulo}</label>
  <div class="campo-linha">
    <input id="${id}" class="campo" type="text" inputmode="decimal" autocomplete="off" value="${esc(paraCampo(valor))}">
    ${sufixo ? `<span class="sufixo">${sufixo}</span>` : ''}
  </div>
  ${ajuda ? `<p class="ajuda" id="${id}-ajuda">${ajuda}</p>` : ''}`;
  }

  function seletorCores(lista, atual) {
    return `<div class="cores">${lista.map(([forte, outra], k) => {
      const sel = forte === atual;
      return `<button class="cor" data-cor="${k}" style="background:${forte};color:${outra}" aria-label="Cor ${k + 1}" aria-pressed="${sel}">${ic('certo', 26, 3)}</button>`;
    }).join('')}</div>`;
  }

  function botaoFoto(foto, rotulo) {
    return `<button class="foto-cad${foto ? ' com-foto' : ''}" data-acao="foto" aria-label="${rotulo}">${foto
      ? `<img src="${foto}" alt="Foto atual">`
      : `${ic('camera', 52, 1.8)}<span>${rotulo}</span>`}</button>
  <input type="file" accept="image/*" capture="environment" id="arquivo-foto" hidden>`;
  }

  function ligarFoto(r, estado) {
    const arquivo = r.querySelector('#arquivo-foto');
    const btn = r.querySelector('[data-acao=foto]');
    btn.addEventListener('click', () => arquivo.click());
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files && arquivo.files[0];
      if (!f) return;
      try {
        estado.foto = await U().reduzirFoto(f, 480);
        btn.innerHTML = `<img src="${estado.foto}" alt="Foto escolhida">`;
        btn.classList.add('com-foto');
      } catch (e) {
        A.mostrarAviso('Não deu para usar essa foto', 'laranja');
      }
    });
  }

  function ligarCores(r, aoEscolher) {
    U().ao(r, '[data-cor]', (b) => {
      r.querySelectorAll('[data-cor]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      aoEscolher(Number(b.dataset.cor));
    });
  }

  function erroHtml() {
    return `<p class="erro" role="alert" hidden>${ic('atencao', 28)} <span></span></p>`;
  }
  function mostrarErro(r, texto) {
    const e = r.querySelector('.erro');
    e.querySelector('span').textContent = texto;
    e.hidden = false;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Miniatura para as listas: foto, ou cor com ícone
  function miniatura(foto, fundo, cor, icone) {
    if (foto) return `<img class="mini-cad" src="${foto}" alt="">`;
    return `<span class="mini-cad" style="background:${fundo};color:${cor}">${ic(icone, 30, 1.8)}</span>`;
  }

  function etiquetaExemplo(x) {
    return x.exemplo ? '<span class="etiqueta">exemplo</span>' : '';
  }

  // Senha: guarda só uma "impressão digital" (não a senha em si). É uma trava simples, não segurança forte.
  function impressaoSenha(pin) {
    let h = 0x811c9dc5;
    const t = 'fabrica-sal|' + pin;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  // Cartão "ÉPOCA AGORA" com os dois botões grandes (menu do dono e tela Época e lotes)
  function cartaoEpoca(epoca, aviso) {
    const E = C().EPOCAS;
    return `
  <section class="cartao-epoca" aria-labelledby="t-epoca">
    <h2 id="t-epoca">ÉPOCA AGORA</h2>
    <div class="grade-2">
      ${['aguas', 'seca'].map((k) => `<button class="btn-epoca ${k}" data-marcar-epoca="${k}" aria-pressed="${epoca === k}">
        ${ic(E[k].icone, 40, 2.2)}<span>${E[k].nome}</span>${epoca === k ? `<small>${ic('certo', 18, 3)} marcada</small>` : ''}</button>`).join('')}
    </div>
    ${!epoca ? '<p class="ajuda">Nenhuma época marcada: o operador não vê sugestão de sal por lote.</p>' : ''}
    ${aviso ? `<p class="aviso-dono">${ic('atencao', 24)} <span><b>Hora de trocar para o sal ${C().EPOCAS[aviso.para].fala}.</b> O app só avisa: a troca é você quem marca aqui.</span></p>` : ''}
  </section>`;
  }
  function ligarEpoca(r, telaAtual) {
    U().ao(r, '[data-marcar-epoca]', async (b) => {
      const k = b.dataset.marcarEpoca;
      await A.db.definir('epocaAtual', k);
      await A.ir(telaAtual);
      A.mostrarAviso(`Época: ${C().EPOCAS[k].nome}. O operador vê o sal ${C().EPOCAS[k].fala} de cada lote.`);
    });
  }
  async function dadosEpoca() {
    const [epoca, meses] = await Promise.all([A.db.config('epocaAtual'), A.db.config('mesesEpoca')]);
    return { epoca: epoca || null, meses: meses || null, aviso: C().avisoTrocaEpoca(epoca, meses) };
  }

  // Usados também no painel (contar estoque)
  Object.assign(A.ui, { lerNumero, paraCampo });

  // ---------- telas ----------

  Object.assign(A.telas, {
    // SENHA DO DONO (entrar ou criar). { destino, params } = para onde ir depois; criar = trocar a senha
    async senha({ destino, params, criar }) {
      const salva = await A.db.config('senhaDono');
      const modoCriar = criar || !salva;
      let digitos = '';
      let primeira = null;
      const voltarPara = criar ? 'dono' : (A.estado.pessoa ? 'inicio' : 'quem');
      const instrucao = modoCriar ? 'Escolha 4 números para a senha.' : 'Digite a senha de 4 números.';
      return {
        fala: modoCriar ? 'Crie a senha do dono. Escolha quatro números.' : 'Digite a senha do dono.',
        html: `
<main class="tela">
  ${topo(modoCriar ? (criar ? 'NOVA SENHA' : 'CRIE A SENHA') : 'SENHA DO DONO')}
  <p class="instrucao" id="instrucao">${instrucao}</p>
  <div class="pontos" aria-live="polite" aria-label="Números digitados: 0 de 4">
    <span class="ponto"></span><span class="ponto"></span><span class="ponto"></span><span class="ponto"></span>
  </div>
  ${erroHtml()}
  <div class="teclado">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="tecla" data-n="${n}">${n}</button>`).join('')}
    <span></span>
    <button class="tecla" data-n="0">0</button>
    <button class="tecla" data-acao="apagar-digito" aria-label="Apagar último número">${ic('voltar', 34, 2.6)}</button>
  </div>
  ${modoCriar ? '' : '<p class="ajuda centro">Esqueceu a senha? Ela só sai apagando os dados do app neste celular.</p>'}
</main>`,
        ligar(r) {
          const pontos = r.querySelectorAll('.ponto');
          const caixa = r.querySelector('.pontos');
          const erro = r.querySelector('.erro');
          const mostrar = () => {
            pontos.forEach((p, k) => p.classList.toggle('cheio', k < digitos.length));
            caixa.setAttribute('aria-label', `Números digitados: ${digitos.length} de 4`);
          };
          const falhar = (texto) => {
            digitos = '';
            mostrar();
            erro.querySelector('span').textContent = texto;
            erro.hidden = false;
            A.voz.falar(texto);
          };
          const completo = async () => {
            if (!modoCriar) {
              if (impressaoSenha(digitos) !== salva) return falhar('Senha errada. Tente de novo.');
              A.estado.donoLiberado = true;
              return A.ir(destino || 'dono', params);
            }
            if (primeira === null) {
              primeira = digitos;
              digitos = '';
              mostrar();
              erro.hidden = true;
              r.querySelector('#instrucao').textContent = 'Digite os mesmos 4 números de novo, para confirmar.';
              A.voz.falar('Digite de novo para confirmar.');
              return;
            }
            if (primeira !== digitos) {
              primeira = null;
              r.querySelector('#instrucao').textContent = instrucao;
              return falhar('As senhas ficaram diferentes. Comece de novo.');
            }
            await A.db.definir('senhaDono', impressaoSenha(digitos));
            A.estado.donoLiberado = true;
            await A.ir(destino || 'dono', params);
            A.mostrarAviso(criar ? 'Senha trocada' : 'Senha criada. Não esqueça!');
          };
          U().ao(r, '[data-n]', (b) => {
            if (digitos.length >= 4) return;
            digitos += b.dataset.n;
            mostrar();
            if (digitos.length === 4) setTimeout(completo, 150);
          });
          U().ao(r, '[data-acao=apagar-digito]', () => { digitos = digitos.slice(0, -1); mostrar(); });
          U().ao(r, '[data-acao=voltar]', () => A.ir(voltarPara));
        },
      };
    },

    trocarSenha() {
      return A.telas.senha({ destino: 'dono', params: {}, criar: true });
    },

    // MENU DA ÁREA DO DONO
    async dono() {
      const [insumos, formulas, pastos, pessoas] = await Promise.all([
        A.db.todos('insumos'), A.db.todos('formulas'), A.db.todos('pastos'), A.db.todos('pessoas'),
      ]);
      const item = (acao, icone, titulo, detalhe) => `
  <button class="btn-menu" data-ir="${acao}">${ic(icone, 40, 1.8)}<span>${titulo}<small>${detalhe}</small></span>${ic('seguir', 28, 2.4)}</button>`;
      const n = (lista, um, varios) => `${lista.length} ${lista.length === 1 ? um : varios}`;
      const avisoCopia = await A.copia.aviso();
      const ep = await dadosEpoca();
      return {
        fala: 'Área do dono. Escolha o que quer cadastrar ou conferir.' +
          (ep.epoca ? ` A época marcada é ${C().EPOCAS[ep.epoca].fala}.` : ' Nenhuma época marcada.') +
          (ep.aviso ? ` Hora de trocar para o sal ${C().EPOCAS[ep.aviso.para].fala}.` : ''),
        html: `
<main class="tela">
  ${U().marca()}
  ${topo('ÁREA DO DONO')}
  ${avisoCopia}
  <button class="btn-menu painel-menu" data-ir="painel">${ic('grafico', 40, 2.2)}<span>Painel<small>Produção, estoque, consumo, compras e problemas</small></span>${ic('seguir', 28, 2.4)}</button>
  ${cartaoEpoca(ep.epoca, ep.aviso)}
  <button class="btn" data-ir="exportarCopia">${ic('baixar', 32, 2.4)} EXPORTAR CÓPIA</button>
  <button class="btn" data-acao="importar">${ic('abrir', 32, 2.4)} IMPORTAR CÓPIA</button>
  ${item('insumos', 'saco', 'Insumos', n(insumos, 'cadastrado', 'cadastrados'))}
  ${item('formulas', 'misturar', 'Fórmulas', n(formulas, 'cadastrada', 'cadastradas'))}
  ${item('pastos', 'pasto', 'Pastos e lotes', n(pastos, 'cadastrado', 'cadastrados'))}
  ${item('epoca', 'calendario', 'Época e lotes', 'Meses da troca e o sal de cada lote')}
  ${item('pessoas', 'pessoa', 'Pessoas', n(pessoas.filter((p) => p.ativo !== false), 'na lista', 'na lista'))}
  ${item('registros', 'mensagem', 'Registros', 'Misturas, chegadas, problemas e estoque')}
  ${item('exemplos', 'ajustes', 'Dados de exemplo', 'Apagar ou recomeçar a demonstração')}
  ${item('trocarSenha', 'chave', 'Trocar a senha', 'Senha de 4 números')}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir(A.estado.pessoa ? 'inicio' : 'quem'));
          U().ao(r, '[data-ir]', (b) => A.ir(b.dataset.ir));
          U().ao(r, '[data-acao=importar]', () => A.copia.escolherArquivo());
          ligarEpoca(r, 'dono');
        },
      };
    },

    // ÉPOCA E LOTES: época atual, meses da troca (opcional) e o sal de cada lote
    async epoca() {
      const [ep, pastos, formulas] = await Promise.all([dadosEpoca(), A.db.todos('pastos'), A.db.todos('formulas')]);
      pastos.sort((a, b) => a.numero - b.numero);
      const fPorId = U().porId(formulas);
      const M = C().MESES;
      const opcoesMes = (sel) => '<option value="">— não avisar —</option>' +
        M.map((nome, k) => `<option value="${k + 1}"${sel === k + 1 ? ' selected' : ''}>${nome[0].toUpperCase() + nome.slice(1)}</option>`).join('');
      const sal = (id) => (fPorId[id]
        ? `<span class="sal-lote" style="--cor-sal:${fPorId[id].cor}"><b>${fPorId[id].numero}</b> ${esc(fPorId[id].nome)}</span>`
        : '<span class="etiqueta">não definido</span>');
      return {
        fala: 'Época e lotes. Marque a época agora, os meses da troca, e confira o sal de cada lote.',
        html: `
<main class="tela">
  ${topo('ÉPOCA E LOTES')}
  ${cartaoEpoca(ep.epoca, ep.aviso)}
  <section class="secao">
    <h2>Meses da troca (opcional)</h2>
    <p class="ajuda">No mês marcado, o Painel e esta área avisam "Hora de trocar". O app nunca troca sozinho.</p>
    <label class="rotulo" for="mes-seca">${ic('sol', 22, 2.2)} A seca começa em</label>
    <select id="mes-seca" class="campo">${opcoesMes(ep.meses && ep.meses.inicioSeca)}</select>
    <label class="rotulo" for="mes-aguas">${ic('gota', 22, 2.2)} As águas começam em</label>
    <select id="mes-aguas" class="campo">${opcoesMes(ep.meses && ep.meses.inicioAguas)}</select>
    <button class="btn verde" data-acao="salvar-meses">${ic('certo', 30, 3)} SALVAR MESES</button>
  </section>
  <section class="secao">
    <h2>Sal de cada lote</h2>
    <p class="ajuda">Toque num lote para mudar.</p>
    <ul class="lista">
      ${pastos.map((p) => `<li><button class="linha-lote" data-pasto="${esc(p.id)}">
        <span class="num-pasto" style="background:${esc(p.cor)}">${p.numero}</span>
        <span class="item-texto"><b>${esc(p.nome)}</b>
          <small>${ic('gota', 16, 2.2)} Águas: ${sal(p.formulaAguasId)}</small>
          <small>${ic('sol', 16, 2.2)} Seca: ${sal(p.formulaSecaId)}</small></span>
        ${ic('seguir', 24, 2.4)}</button></li>`).join('') || '<li>Nenhum pasto cadastrado.</li>'}
    </ul>
  </section>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          ligarEpoca(r, 'epoca');
          U().ao(r, '[data-pasto]', (b) => A.ir('pasto', { id: b.dataset.pasto }));
          U().ao(r, '[data-acao=salvar-meses]', async () => {
            const seca = Number(r.querySelector('#mes-seca').value) || null;
            const aguas = Number(r.querySelector('#mes-aguas').value) || null;
            if (seca && aguas && seca === aguas) {
              A.mostrarAviso('A seca e as águas não podem começar no mesmo mês', 'laranja');
              return;
            }
            await A.db.definir('mesesEpoca', seca || aguas ? { inicioSeca: seca, inicioAguas: aguas } : null);
            await A.ir('epoca');
            A.mostrarAviso('Meses da troca salvos');
          });
        },
      };
    },

    // ---------- INSUMOS ----------

    async insumos() {
      const lista = (await A.db.todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return {
        fala: 'Insumos. Toque num insumo para mudar, ou em novo insumo.',
        html: `
<main class="tela">
  ${topo('INSUMOS')}
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVO INSUMO</button>
  ${lista.length ? `<button class="btn" data-acao="precos">${ic('saco', 30, 2)} ATUALIZAR PREÇOS</button>` : ''}
  ${lista.map((i) => `
  <button class="item-cad" data-id="${esc(i.id)}">
    ${miniatura(i.foto, i.cor, i.corTexto, 'saco')}
    <span class="item-texto"><b>${esc(i.nome)}</b>
      <small>Estoque: ${U().qtdQ(i.estoqueKg, i)} · mínimo ${U().qtdQ(i.estoqueMinimoKg || 0, i)}</small>
      <small>${C().precoKg(i) !== null ? U().reaisQ(C().precoKg(i), '/kg') : '<span class="etiqueta">sem preço</span>'}${C().unidade(i).kgPor ? ` · ${esc(C().unidade(i).um)} atual ${U().kgQ(C().unidade(i).kgPor)}` : ' · a granel'}${i.maxPct > 0 ? ` · máximo na mistura ${U().q(C().numero(i.maxPct), '%')}` : ''}</small></span>
    ${etiquetaExemplo(i)}
  </button>`).join('') || '<p class="vazio">Nenhum insumo cadastrado.</p>'}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=novo]', () => A.ir('insumo', {}));
          U().ao(r, '[data-acao=precos]', () => A.ir('precos', { volta: 'insumos' }));
          U().ao(r, '[data-id]', (b) => A.ir('insumo', { id: b.dataset.id }));
        },
      };
    },

    // ATUALIZAR PREÇOS: para cada insumo, o peso do saco desta compra (botões) e o preço do saco.
    // Guarda o R$/kg (o custo das fórmulas usa sempre o R$/kg) e o peso vira o "saco atual" do insumo.
    async precos({ volta }) {
      const lista = (await A.db.todos('insumos')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const voltar = volta || 'insumos';
      // Estado de cada insumo: peso escolhido (kg do saco) e o valor digitado (R$ do saco; a granel, R$/kg)
      const est = {};
      lista.forEach((i) => {
        const u = C().unidade(i);
        const pk = C().precoKg(i);
        est[i.id] = { peso: u.kgPor || null, granel: !!u.granel, preco: pk !== null ? (u.kgPor ? pk * u.kgPor : pk) : null };
      });
      const opcoesPeso = (i) => {
        const u = C().unidade(i);
        return [...new Set([...(C().PESOS_COMUNS[i.unidade || 'saco'] || []), u.kgPor, est[i.id].peso].filter((x) => x > 0))].sort((a, b) => a - b);
      };
      const chips = (i) => opcoesPeso(i).map((p) => {
        const sel = Math.abs(p - est[i.id].peso) < 0.05;
        return `<button class="opcao peso" data-ins="${esc(i.id)}" data-peso="${p}" aria-pressed="${sel}">${sel ? ic('certo', 16, 3.4) : ''}${C().numero(p)} kg</button>`;
      }).join('') + `<button class="opcao peso outro" data-ins="${esc(i.id)}" data-acao="outro-peso">OUTRO</button>`;
      return {
        fala: 'Atualizar preços. Para cada insumo, toque no peso do saco e escreva o preço do saco. O app mostra o preço do quilo. Deixe em branco o que não sabe.',
        html: `
<main class="tela">
  ${topo('PREÇOS')}
  <p class="ajuda">Escolha o peso do saco desta compra e escreva o preço do saco. O app guarda o <b>R$ por kg</b> (o custo das fórmulas usa sempre o R$/kg) e o peso vira o saco atual do insumo. Em branco = "sem preço".</p>
  ${lista.map((i) => {
    const e = est[i.id];
    const u = C().unidade(i);
    return `
  <div class="secao contagem" data-bloco="${esc(i.id)}">
    <label class="rotulo" for="p-${esc(i.id)}">${esc(i.nome)}</label>
    ${e.granel ? '<p class="ajuda">A granel: preço por kg.</p>' : `
    <div class="rotulo-peso">PESO DO ${esc(u.um.toUpperCase())}</div>
    <div class="pesos" data-pesos="${esc(i.id)}">${chips(i)}</div>
    <div class="campo-linha" data-outro="${esc(i.id)}" hidden>
      <input class="campo" type="text" inputmode="decimal" autocomplete="off" data-peso-outro="${esc(i.id)}" placeholder="Outro peso" aria-label="Outro peso do ${esc(u.um)} de ${esc(i.nome)}">
      <span class="sufixo">kg</span>
    </div>`}
    <div class="campo-linha">
      <span class="sufixo">R$</span>
      <input id="p-${esc(i.id)}" data-id="${esc(i.id)}" class="campo" type="text" inputmode="decimal" autocomplete="off" value="${esc(paraCampo(e.preco === null ? null : Math.round(e.preco * 100) / 100))}" placeholder="sem preço">
      <span class="sufixo">/${e.granel ? 'kg' : esc(u.um)}</span>
    </div>
    <p class="preco-kg" data-ajuda="${esc(i.id)}" aria-live="polite"></p>
  </div>`;
  }).join('') || '<p class="vazio">Nenhum insumo cadastrado.</p>'}
  ${erroHtml()}
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR PREÇOS</button>
</main>`,
        ligar(r) {
          const porId = U().porId(lista);
          const mostrarKg = (id) => {
            const e = est[id];
            const v = lerNumero(r.querySelector(`#p-${CSS.escape(id)}`).value);
            const caixa = r.querySelector(`[data-ajuda="${CSS.escape(id)}"]`);
            if (!(v > 0)) { caixa.innerHTML = ''; return; }
            const pk = e.granel ? v : (e.peso > 0 ? v / e.peso : null);
            caixa.innerHTML = pk === null ? 'Escolha o peso do saco.' : `= ${U().reaisQ(pk, '/kg', 2)}${e.granel ? '' : ` <span class="ajuda">(R$ ${U().reaisTexto(v)} ÷ ${C().numero(e.peso)} kg)</span>`}`;
          };
          lista.forEach((i) => mostrarKg(i.id));
          r.querySelectorAll('input[data-id]').forEach((c) => c.addEventListener('input', () => mostrarKg(c.dataset.id)));
          r.addEventListener('click', (ev) => {
            const b = ev.target.closest('button[data-ins]');
            if (!b) return;
            const id = b.dataset.ins;
            if (b.dataset.acao === 'outro-peso') {
              const linha = r.querySelector(`[data-outro="${CSS.escape(id)}"]`);
              linha.hidden = false;
              linha.querySelector('input').focus();
              return;
            }
            est[id].peso = Number(b.dataset.peso);
            r.querySelector(`[data-pesos="${CSS.escape(id)}"]`).innerHTML = chips(porId[id]);
            mostrarKg(id);
          });
          r.querySelectorAll('input[data-peso-outro]').forEach((c) => c.addEventListener('input', () => {
            const v = lerNumero(c.value);
            if (v > 0 && v <= 2000) {
              est[c.dataset.pesoOutro].peso = Math.round(v * 10) / 10;
              r.querySelector(`[data-pesos="${CSS.escape(c.dataset.pesoOutro)}"]`).innerHTML = chips(porId[c.dataset.pesoOutro]);
              mostrarKg(c.dataset.pesoOutro);
            }
          }));
          U().ao(r, '[data-acao=voltar]', () => A.ir(voltar));
          U().ao(r, '[data-acao=salvar]', async (b) => {
            const mudados = [];
            for (const c of r.querySelectorAll('input[data-id]')) {
              const ins = porId[c.dataset.id];
              const e = est[ins.id];
              const v = c.value.trim() === '' ? null : lerNumero(c.value);
              if (c.value.trim() !== '' && (v === null || v < 0)) return mostrarErro(r, `Confira o preço de ${ins.nome}.`);
              if (!e.granel && !(e.peso > 0)) return mostrarErro(r, `Escolha o peso do saco de ${ins.nome}.`);
              const novoPk = v > 0 ? Math.round((e.granel ? v : v / e.peso) * 10000) / 10000 : null;
              const pkAntes = C().precoKg(ins);
              const pesoMudou = !e.granel && Math.abs(e.peso - (ins.kgPorSaco || 0)) > 0.05;
              const precoMudou = (novoPk === null) !== (pkAntes === null) || (novoPk !== null && Math.abs(novoPk - pkAntes) > 0.00005);
              if (precoMudou || pesoMudou) {
                mudados.push(Object.assign({}, ins, {
                  precoKg: novoPk, precoPorUnidade: null, // o preço fica guardado por kg
                  kgPorSaco: e.granel ? ins.kgPorSaco : e.peso, // o peso mais recente vira o saco atual
                  exemplo: false,
                }));
              }
            }
            b.disabled = true;
            if (mudados.length) await A.db.transacao(['insumos'], (l) => mudados.forEach((x) => l('insumos').put(x)));
            await A.ir(voltar);
            A.mostrarAviso(mudados.length ? `Preços salvos (${mudados.length})` : 'Nada mudou');
          });
        },
      };
    },

    async insumo({ id }) {
      const atual = id ? await A.db.pegar('insumos', id) : null;
      const estoqueAntes = atual ? atual.estoqueKg : 0; // para registrar a correção de estoque
      const e = atual
        ? Object.assign({}, atual, { unidade: atual.unidade || 'saco' })
        : { nome: '', cor: CORES_INSUMO[0][0], corTexto: CORES_INSUMO[0][1], unidade: 'saco', kgPorSaco: 50, estoqueKg: 0, estoqueMinimoKg: 0, precoKg: null, foto: null };
      const granel = () => e.unidade === 'kg';
      // Estoque e mínimo aparecem em sacos (ou baldes, bags); a granel, em kg
      const emUnidades = (kg) => (granel() || !e.kgPorSaco ? kg : kg / e.kgPorSaco);
      return {
        fala: atual ? `Editar ${atual.nome}.` : 'Novo insumo. Tire a foto, escreva o nome e preencha os números.',
        html: `
<main class="tela">
  ${topo(atual ? 'EDITAR INSUMO' : 'NOVO INSUMO')}
  ${botaoFoto(e.foto, 'FOTO DO SACO')}
  <label class="rotulo" for="nome">Nome</label>
  <input id="nome" class="campo" type="text" autocomplete="off" autocapitalize="sentences" maxlength="40" placeholder="Ex.: Ureia" value="${esc(e.nome)}">
  <div class="rotulo">Como chega</div>
  <div class="grade-2">
    ${Object.keys(ROTULO_UNIDADE).map((u) => `<button class="opcao" data-unidade="${u}" aria-pressed="${e.unidade === u}">${ROTULO_UNIDADE[u]}</button>`).join('')}
  </div>
  <div id="bloco-kg-por">
    ${campoNumero('kg-por', 'Quantos kg tem o <span data-un="um">saco</span> atual?', granel() ? '' : e.kgPorSaco, 'kg', 'O estoque fica guardado em kg. O saco atual muda sozinho quando chega uma compra com outro peso.')}
  </div>
  ${campoNumero('estoque', 'Estoque agora', emUnidades(e.estoqueKg), '<span data-un="varios">sacos</span>', ' ')}
  ${campoNumero('minimo', 'Estoque mínimo (avisa quando ficar abaixo)', emUnidades(e.estoqueMinimoKg || 0), '<span data-un="varios">sacos</span>', ' ')}
  ${campoNumero('preco', 'Preço por kg (opcional)', C().precoKg(e), 'R$/kg', 'Usado no custo da batida, do kg e por cabeça. Para calcular pelo preço do saco, use Insumos → ATUALIZAR PREÇOS. Sem preço, o app mostra "sem preço".')}
  ${campoNumero('maximo-pct', 'Máximo na mistura (opcional)', e.maxPct, '%', 'Quem informa é o técnico. Sem valor, o app não confere. Com valor, avisa ao salvar uma fórmula que passe dele.')}
  <div class="rotulo">Cor do quadro (aparece quando não tem foto)</div>
  ${seletorCores(CORES_INSUMO, e.cor)}
  ${erroHtml()}
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${atual ? `<button class="btn" data-acao="apagar">${ic('problema', 28)} Apagar insumo</button>` : ''}
</main>`,
        ligar(r) {
          const campo = (x) => r.querySelector('#' + x);
          ligarFoto(r, e);
          ligarCores(r, (k) => { e.cor = CORES_INSUMO[k][0]; e.corTexto = CORES_INSUMO[k][1]; });

          // Atualiza os textos conforme a unidade e mostra o total em kg
          const atualizar = () => {
            const g = granel();
            const u = C().UNIDADES[e.unidade];
            r.querySelector('#bloco-kg-por').hidden = g;
            r.querySelectorAll('[data-un=um]').forEach((s) => { s.textContent = g ? 'kg' : u.um; });
            r.querySelectorAll('[data-un=varios]').forEach((s) => { s.textContent = g ? 'kg' : u.varios; });
            const kgPor = lerNumero(campo('kg-por').value);
            ['estoque', 'minimo'].forEach((x) => {
              const v = lerNumero(campo(x).value);
              const ajuda = campo(x + '-ajuda');
              ajuda.textContent = !g && v !== null && kgPor ? `= ${C().numero(v * kgPor)} kg` : '';
            });
          };
          U().ao(r, '[data-unidade]', (b) => {
            e.unidade = b.dataset.unidade;
            r.querySelectorAll('[data-unidade]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
            atualizar();
          });
          ['kg-por', 'estoque', 'minimo'].forEach((x) => campo(x).addEventListener('input', atualizar));
          atualizar();

          U().ao(r, '[data-acao=voltar]', () => A.ir('insumos'));

          U().ao(r, '[data-acao=salvar]', async (b) => {
            const nome = campo('nome').value.trim().replace(/\s+/g, ' ');
            const g = granel();
            const kgPor = g ? 0 : lerNumero(campo('kg-por').value);
            const estoque = lerNumero(campo('estoque').value);
            const minimo = lerNumero(campo('minimo').value);
            const preco = lerNumero(campo('preco').value);
            if (!nome) return mostrarErro(r, 'Escreva o nome do insumo.');
            const outros = (await A.db.todos('insumos')).filter((x) => x.id !== (atual && atual.id));
            if (outros.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) return mostrarErro(r, 'Já existe um insumo com esse nome.');
            if (!g && !(kgPor > 0)) return mostrarErro(r, 'Diga quantos kg tem cada ' + C().UNIDADES[e.unidade].um + '.');
            if (estoque === null || estoque < 0) return mostrarErro(r, 'Preencha o estoque agora (pode ser 0).');
            if (minimo !== null && minimo < 0) return mostrarErro(r, 'O estoque mínimo não pode ser negativo.');
            if (preco !== null && preco < 0) return mostrarErro(r, 'O preço não pode ser negativo.');
            // Preço não mexido (o campo mostra só 2 casas): mantém o R$/kg exato que já estava guardado
            const pkAntes = atual ? C().precoKg(atual) : null;
            const precoKgFinal = preco !== null && pkAntes !== null && Math.abs(preco - Math.round(pkAntes * 100) / 100) < 0.0001 ? pkAntes : preco;
            const maxPct = lerNumero(campo('maximo-pct').value);
            if (maxPct !== null && !(maxPct > 0 && maxPct <= 100)) return mostrarErro(r, 'O máximo na mistura precisa ser entre 0 e 100%.');

            b.disabled = true;
            const paraKg = (v) => Math.round((g ? v : v * kgPor) * 10) / 10;
            const registro = Object.assign(atual || { id: A.db.novoId('insumo'), criadoEm: new Date().toISOString() }, {
              nome, foto: e.foto || null, cor: e.cor, corTexto: e.corTexto, unidade: e.unidade, kgPorSaco: kgPor,
              estoqueKg: paraKg(estoque), estoqueMinimoKg: paraKg(minimo || 0), precoKg: precoKgFinal, precoPorUnidade: null, maxPct, // preço guardado em R$/kg
              exemplo: false, // editou: passa a ser cadastro de verdade
            });
            const antes = estoqueAntes;
            const mudouEstoque = Math.abs(registro.estoqueKg - antes) > 0.05;
            await A.db.transacao(['insumos', 'contagens'], (l) => {
              l('insumos').put(registro);
              if (mudouEstoque) {
                l('contagens').put({
                  id: A.db.novoId('contagem'), insumoId: registro.id, insumoNome: registro.nome,
                  antesKg: antes, depoisKg: registro.estoqueKg, quando: new Date().toISOString(),
                  tipo: atual ? 'correcao' : 'inicial', exemplo: false,
                });
              }
            });
            await A.ir('insumos');
            A.mostrarAviso(nome + ' salvo');
          });

          U().ao(r, '[data-acao=apagar]', async () => {
            const formulas = await A.db.todos('formulas');
            const usam = formulas.filter((f) => f.itens.some((it) => it.insumoId === atual.id));
            if (usam.length) {
              return mostrarErro(r, `Não dá para apagar: ${atual.nome} está nas fórmulas ${usam.map((f) => f.nome).join(', ')}. Tire de lá antes.`);
            }
            if (!confirm(`Apagar o insumo ${atual.nome}? O histórico das misturas continua.`)) return;
            await A.db.apagar('insumos', atual.id);
            await A.ir('insumos');
            A.mostrarAviso(atual.nome + ' apagado');
          });
        },
      };
    },

    // ---------- FÓRMULAS ----------

    async formulas() {
      const [lista, insumos] = await Promise.all([A.db.todos('formulas'), A.db.todos('insumos')]);
      lista.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      const ids = new Set(insumos.map((i) => i.id));
      const insPorId = U().porId(insumos);
      return {
        fala: 'Fórmulas. Toque numa fórmula para mudar, ou em nova fórmula.',
        html: `
<main class="tela">
  ${topo('FÓRMULAS')}
  <p class="ajuda">As quantidades vêm do técnico ou nutricionista. O app só segue a fórmula e registra.</p>
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVA FÓRMULA</button>
  ${lista.map((f) => {
    const quebrada = f.itens.some((it) => !ids.has(it.insumoId));
    const ts = C().tamanhos(f);
    const custo = C().custoItens(f.itens, insPorId);
    const limite = C().passaLimite(f.itens, insPorId);
    return `
  <button class="item-cad" data-id="${esc(f.id)}">
    ${miniatura(f.foto, f.corClara, f.cor, 'misturar')}
    <span class="item-texto"><b>${f.numero} · ${esc(f.nome)}</b>
      <small>${U().q(f.itens.length, f.itens.length === 1 ? 'insumo' : 'insumos')} · batida <span class="q">${ts.map((t) => `<b>${C().numero(t)}</b>`).join(' ou ')} <small>kg</small></span></small>
      <small>${custo.porKg !== null ? U().reaisQ(custo.porKg, '/kg') : '<span class="etiqueta">sem preço</span>'}${limite.length ? ` <span class="etiqueta ruim">${ic('atencao', 14)} passa do limite</span>` : ''}</small>
      <span class="selos-linha">${U().seloTipo(f) || '<span class="etiqueta">sem tipo</span>'}${U().seloEpoca(f)}</span></span>
    ${quebrada ? '<span class="etiqueta ruim">falta insumo</span>' : etiquetaExemplo(f)}
  </button>`;
  }).join('') || '<p class="vazio">Nenhuma fórmula cadastrada.</p>'}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=novo]', () => A.ir('formula', {}));
          U().ao(r, '[data-id]', (b) => A.ir('formula', { id: b.dataset.id }));
        },
      };
    },

    async formula({ id }) {
      const [atual, insumos, todas, misturas] = await Promise.all([
        id ? A.db.pegar('formulas', id) : null, A.db.todos('insumos'), A.db.todos('formulas'), A.db.todos('misturas'),
      ]);
      insumos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const porId = U().porId(insumos);
      const proximoNumero = todas.reduce((m, f) => Math.max(m, f.numero || 0), 0) + 1;
      const e = atual
        ? { nome: atual.nome, numero: atual.numero, cor: atual.cor, corClara: atual.corClara, foto: atual.foto || null, itens: atual.itens.map((it) => Object.assign({}, it)) }
        : { nome: '', numero: proximoNumero, cor: CORES_FORTES[0][0], corClara: CORES_FORTES[0][1], foto: null, itens: [] };
      // Tamanhos da batida. Sem tamanhos cadastrados ("automático"), o tamanho é o total da receita e acompanha a receita.
      e.tamanhosAuto = !(atual && Array.isArray(atual.tamanhos) && atual.tamanhos.length);
      e.tamanhos = e.tamanhosAuto ? [] : C().tamanhos(atual);
      e.padrao = atual && !e.tamanhosAuto ? C().tamanhoPadrao(atual) : null;
      // Tipo (sem tipo = fórmula antiga ainda não marcada) e época (sem época = ano todo)
      e.tipo = atual && C().TIPOS[atual.tipo] ? atual.tipo : null;
      e.epoca = C().epocaDaFormula(atual);

      if (!insumos.length) {
        return {
          fala: 'Cadastre os insumos antes de fazer uma fórmula.',
          html: `
<main class="tela">
  ${topo('NOVA FÓRMULA')}
  <p class="vazio">Cadastre os insumos antes de montar uma fórmula.</p>
  <button class="btn verde" data-acao="ir-insumos">${ic('saco', 34)} IR PARA INSUMOS</button>
</main>`,
          ligar(r) {
            U().ao(r, '[data-acao=voltar]', () => A.ir('formulas'));
            U().ao(r, '[data-acao=ir-insumos]', () => A.ir('insumos'));
          },
        };
      }

      const opcoes = (sel) => `<option value="">Escolha o insumo</option>` +
        insumos.map((i) => `<option value="${esc(i.id)}"${i.id === sel ? ' selected' : ''}>${esc(i.nome)}</option>`).join('');

      return {
        fala: atual ? `Editar ${atual.nome}.` : 'Nova fórmula. Escreva o nome e adicione os insumos com os quilos de cada batida.',
        html: `
<main class="tela">
  ${topo(atual ? 'EDITAR FÓRMULA' : 'NOVA FÓRMULA')}
  <p class="ajuda">As quantidades vêm do técnico ou nutricionista. O app só segue a fórmula e registra.</p>
  <label class="rotulo" for="nome">Nome do sal</label>
  <input id="nome" class="campo" type="text" autocomplete="off" autocapitalize="sentences" maxlength="40" placeholder="Ex.: Sal mineral" value="${esc(e.nome)}">
  ${campoNumero('numero', 'Número (o operador vê no cartão)', e.numero, '')}
  <div class="rotulo">Tipo</div>
  <div class="grade-3">
    ${Object.keys(C().TIPOS).map((t) => `<button class="opcao opcao-icone" data-tipo="${t}" aria-pressed="${e.tipo === t}">${ic(C().TIPOS[t].icone, 30, 2)}<span>${C().TIPOS[t].nome}</span></button>`).join('')}
  </div>
  <div class="rotulo">Época</div>
  <div class="grade-3">
    ${Object.keys(C().EPOCAS).map((k) => `<button class="opcao opcao-icone" data-epoca-f="${k}" aria-pressed="${e.epoca === k}">${ic(C().EPOCAS[k].icone, 30, 2)}<span>${C().EPOCAS[k].nome}</span></button>`).join('')}
  </div>
  <div class="rotulo">Insumos de uma batida (na ordem sugerida)</div>
  <div id="itens" class="itens"></div>
  <button class="btn" data-acao="adicionar">${ic('mais', 30, 2.6)} ADICIONAR INSUMO</button>
  <p class="total-batida" id="total"></p>
  <div class="rotulo">Tamanhos da batida</div>
  <p class="ajuda">A receita acima é a batida base. O operador escolhe o tamanho em botões grandes e o app recalcula
    cada insumo na mesma proporção. Toque num tamanho para ele ser o normal (padrão).</p>
  <div id="tamanhos" class="tamanhos"></div>
  <div class="campo-linha">
    <input id="novo-tamanho" class="campo" type="text" inputmode="decimal" autocomplete="off" placeholder="Outro tamanho" aria-label="Outro tamanho da batida, em kg">
    <span class="sufixo">kg</span>
  </div>
  <button class="btn" data-acao="add-tamanho">${ic('mais', 30, 2.6)} ADICIONAR TAMANHO</button>
  <div id="previa" class="previa-tamanhos"></div>
  <div id="limite" class="alerta vermelho alerta-limite" role="alert" hidden></div>
  <div class="rotulo">Custo</div>
  <div id="custo" class="custo-formula"></div>
  <div class="rotulo">Comparar com sal comprado pronto (opcional)</div>
  <div class="grade-2">
    <div>${campoNumero('pronto-preco', 'Preço do saco', atual ? atual.prontoPrecoSaco : null, 'R$')}</div>
    <div>${campoNumero('pronto-kg', 'Kg do saco', atual ? atual.prontoKgSaco : null, 'kg')}</div>
  </div>
  <div id="compara" class="custo-formula"></div>
  <div class="rotulo">Cor do cartão</div>
  ${seletorCores(CORES_FORTES, e.cor)}
  <div class="rotulo">Foto do sal (opcional)</div>
  ${botaoFoto(e.foto, 'FOTO DO SAL')}
  ${erroHtml()}
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${atual ? `<button class="btn" data-acao="apagar">${ic('problema', 28)} Apagar fórmula</button>` : ''}
</main>`,
        ligar(r) {
          const caixa = r.querySelector('#itens');
          U().ao(r, '[data-tipo]', (b) => {
            e.tipo = b.dataset.tipo;
            r.querySelectorAll('[data-tipo]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
          });
          U().ao(r, '[data-epoca-f]', (b) => {
            e.epoca = b.dataset.epocaF;
            r.querySelectorAll('[data-epoca-f]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
          });
          ligarFoto(r, e);
          ligarCores(r, (k) => { e.cor = CORES_FORTES[k][0]; e.corClara = CORES_FORTES[k][1]; });

          // ---- tamanhos da batida ----
          const totalReceita = () => Math.round(e.itens.reduce((s, it) => s + (it.kg > 0 ? it.kg : 0), 0) * 10) / 10;
          const listaTamanhos = () => (e.tamanhosAuto ? (totalReceita() > 0 ? [totalReceita()] : []) : e.tamanhos);
          const padraoAtual = () => {
            const ts = listaTamanhos();
            return ts.includes(e.padrao) ? e.padrao : ts[ts.length - 1];
          };
          const desenharTamanhos = () => {
            const ts = listaTamanhos();
            const pd = padraoAtual();
            r.querySelector('#tamanhos').innerHTML = ts.length ? ts.map((t) => `
    <span class="chip-tamanho${t === pd ? ' padrao' : ''}">
      <button class="chip-escolher" data-padrao="${t}" aria-pressed="${t === pd}">${t === pd ? ic('certo', 20, 3) : ''} ${C().numero(t)} kg${t === pd ? ' · normal' : ''}</button>
      ${e.tamanhosAuto ? '' : `<button class="chip-tirar" data-tirar-tamanho="${t}" aria-label="Tirar ${C().numero(t)} kg">${ic('mais', 18, 2.6)}</button>`}
    </span>`).join('') : '<p class="ajuda">Preencha a receita para ver o tamanho.</p>';
            // Prévia: como fica cada tamanho, em sacos
            const base = totalReceita();
            const validos = e.itens.filter((it) => porId[it.insumoId] && it.kg > 0);
            r.querySelector('#previa').innerHTML = base > 0 && validos.length ? ts.map((t) => `
    <p class="ajuda"><b>${C().numero(t)} kg:</b> ${validos.map((it) =>
      `${esc(porId[it.insumoId].nome)} ${esc(C().qtdTexto(Math.round((it.kg * t / base) * 10) / 10, porId[it.insumoId]))}`).join(' · ')}</p>`).join('') : '';
          };
          r.querySelector('#tamanhos').addEventListener('click', (ev) => {
            const b = ev.target.closest('button');
            if (!b) return;
            if (b.dataset.padrao !== undefined) e.padrao = Number(b.dataset.padrao);
            if (b.dataset.tirarTamanho !== undefined) {
              e.tamanhos = e.tamanhos.filter((t) => t !== Number(b.dataset.tirarTamanho));
              if (!e.tamanhos.length) e.tamanhosAuto = true; // sem nenhum: volta a ser o total da receita
            }
            desenharTamanhos();
          });
          U().ao(r, '[data-acao=add-tamanho]', () => {
            const campo = r.querySelector('#novo-tamanho');
            const v = lerNumero(campo.value);
            if (!(v > 0)) return mostrarErro(r, 'Escreva o tamanho da batida em kg (ex.: 350).');
            r.querySelector('.erro').hidden = true;
            if (e.tamanhosAuto) {
              e.tamanhos = totalReceita() > 0 ? [totalReceita()] : [];
              if (e.padrao === null && e.tamanhos.length) e.padrao = e.tamanhos[0];
              e.tamanhosAuto = false;
            }
            const t = Math.round(v * 10) / 10;
            if (!e.tamanhos.includes(t)) e.tamanhos = e.tamanhos.concat(t).sort((a, b) => a - b);
            campo.value = '';
            desenharTamanhos();
          });

          // ---- custo, comparação com o sal pronto e limite por insumo (ao vivo) ----
          const itensValidos = () => e.itens.filter((it) => porId[it.insumoId] && it.kg > 0);
          const desenharCusto = () => {
            const itens = itensValidos();
            const c = C().custoItens(itens, porId);
            const base = totalReceita();
            const caixaCusto = r.querySelector('#custo');
            if (!itens.length) caixaCusto.innerHTML = '<p class="ajuda">Preencha a receita para ver o custo.</p>';
            else if (c.porKg === null) {
              caixaCusto.innerHTML = `<p><span class="etiqueta">sem preço</span> ${esc(c.semPreco.join(', '))}</p>
                <p class="ajuda">O custo aparece quando todos os insumos tiverem preço (Insumos → ATUALIZAR PREÇOS).</p>`;
            } else {
              caixaCusto.innerHTML = `<p>Batida base de ${U().kgQ(base)}: ${U().reaisQ(c.total)} · ${U().reaisQ(c.porKg, '/kg')}</p>` +
                listaTamanhos().filter((t) => t !== base).map((t) => `<p class="ajuda">Batida de ${U().kgQ(t)}: ${U().reaisQ(c.porKg * t)}</p>`).join('');
            }
            // Comparação com o sal pronto
            const preco = lerNumero(r.querySelector('#pronto-preco').value);
            const kgSaco = lerNumero(r.querySelector('#pronto-kg').value);
            const caixaComp = r.querySelector('#compara');
            if (preco > 0 && kgSaco > 0) {
              const prontoKg = preco / kgSaco;
              const kg30 = atual ? (C().kgPorFormula(misturas, 30)[atual.id] || 0) : 0;
              const fab = c.porKg;
              const eco = fab !== null ? kg30 * (prontoKg - fab) : null;
              caixaComp.innerHTML = `<p>Fabricando: ${fab !== null ? U().reaisQ(fab, '/kg') : 'sem preço'} · Pronto: ${U().reaisQ(prontoKg, '/kg')}</p>
                <p>${eco === null ? '' : kg30 > 0
                  ? `${eco >= 0 ? 'Economia' : 'Gasto a mais'} no mês: <b class="${eco >= 0 ? 'positivo' : 'negativo'}">${U().reaisQ(Math.abs(eco), '', 0)}</b> <span class="ajuda">(${U().kgQ(kg30)} feitos nos últimos 30 dias)</span>`
                  : '<span class="ajuda">Economia no mês: sem produção desta fórmula nos últimos 30 dias.</span>'}</p>`;
            } else caixaComp.innerHTML = '<p class="ajuda">Preencha o preço e o kg do saco do sal pronto para comparar.</p>';
            // Limite por insumo: aviso vermelho com a conta
            const v = C().passaLimite(itens, porId);
            const caixaLim = r.querySelector('#limite');
            caixaLim.hidden = !v.length;
            caixaLim.innerHTML = v.length ? `${ic('problema', 40, 2.4)}<div><b>PASSA DO LIMITE</b>
              ${v.map((x) => `<span>${esc(C().textoLimite(x))}</span>`).join('')}
              <span>Confira com o técnico. Para salvar assim, você vai precisar confirmar.</span></div>` : '';
            const salvar = r.querySelector('[data-acao=salvar]');
            if (salvar && (!v.length || e.confirmaLimite !== JSON.stringify(v))) {
              e.confirmaLimite = null;
              salvar.className = 'btn verde grande';
              salvar.innerHTML = `${ic('certo', 44, 3)} SALVAR`;
            }
          };
          ['pronto-preco', 'pronto-kg'].forEach((x) => r.querySelector('#' + x).addEventListener('input', desenharCusto));

          const mostrarTotal = () => {
            const total = totalReceita();
            r.querySelector('#total').textContent = e.itens.length ? `Total da batida base: ${C().numero(total)} kg` : '';
            desenharTamanhos();
            desenharCusto();
          };
          const ajudaItem = (it) => {
            const ins = porId[it.insumoId];
            return ins && it.kg > 0 && C().unidade(ins).kgPor ? '= ' + C().qtdTexto(it.kg, ins) : '';
          };
          const desenhar = () => {
            caixa.innerHTML = e.itens.map((it, k) => `
    <div class="linha-ing">
      <span class="ordem">${k + 1}</span>
      <div class="ing-campos">
        <select class="campo" data-k="${k}" data-campo="insumo" aria-label="Insumo ${k + 1}">${opcoes(it.insumoId)}</select>
        <div class="campo-linha">
          <input class="campo" type="text" inputmode="decimal" data-k="${k}" data-campo="kg" aria-label="Quilos de ${k + 1}" value="${esc(paraCampo(it.kg))}" placeholder="0">
          <span class="sufixo">kg</span>
        </div>
        <span class="ajuda" data-ajuda="${k}">${esc(ajudaItem(it))}</span>
      </div>
      <div class="ing-acoes">
        <button class="btn-pequeno" data-mover="${k}" data-dir="-1" aria-label="Subir" ${k === 0 ? 'disabled' : ''}>${ic('voltar', 22, 2.6)}</button>
        <button class="btn-pequeno" data-mover="${k}" data-dir="1" aria-label="Descer" ${k === e.itens.length - 1 ? 'disabled' : ''}>${ic('voltar', 22, 2.6)}</button>
        <button class="btn-pequeno ruim" data-tirar="${k}" aria-label="Tirar">${ic('mais', 22, 2.6)}</button>
      </div>
    </div>`).join('') || '<p class="ajuda">Nenhum insumo ainda. Toque em ADICIONAR INSUMO.</p>';
            mostrarTotal();
          };
          caixa.addEventListener('change', (ev) => {
            const k = Number(ev.target.dataset.k);
            if (ev.target.dataset.campo === 'insumo') { e.itens[k].insumoId = ev.target.value; desenhar(); }
          });
          caixa.addEventListener('input', (ev) => {
            const k = Number(ev.target.dataset.k);
            if (ev.target.dataset.campo === 'kg') {
              e.itens[k].kg = lerNumero(ev.target.value);
              caixa.querySelector(`[data-ajuda="${k}"]`).textContent = ajudaItem(e.itens[k]);
              mostrarTotal();
            }
          });
          caixa.addEventListener('click', (ev) => {
            const b = ev.target.closest('button');
            if (!b) return;
            if (b.dataset.tirar !== undefined) e.itens.splice(Number(b.dataset.tirar), 1);
            if (b.dataset.mover !== undefined) {
              const k = Number(b.dataset.mover);
              const j = k + Number(b.dataset.dir);
              [e.itens[k], e.itens[j]] = [e.itens[j], e.itens[k]];
            }
            desenhar();
          });
          U().ao(r, '[data-acao=adicionar]', () => {
            e.itens.push({ insumoId: '', kg: null });
            desenhar();
            const sel = caixa.querySelectorAll('select');
            if (sel.length) sel[sel.length - 1].focus();
          });
          desenhar();

          U().ao(r, '[data-acao=voltar]', () => A.ir('formulas'));

          U().ao(r, '[data-acao=salvar]', async (b) => {
            const nome = r.querySelector('#nome').value.trim().replace(/\s+/g, ' ');
            const numero = lerNumero(r.querySelector('#numero').value);
            if (!nome) return mostrarErro(r, 'Escreva o nome do sal.');
            if (!(Number.isInteger(numero) && numero >= 1)) return mostrarErro(r, 'O número precisa ser 1, 2, 3...');
            const outras = todas.filter((f) => f.id !== (atual && atual.id));
            const mesmoNumero = outras.find((f) => f.numero === numero);
            if (mesmoNumero) return mostrarErro(r, `O número ${numero} já é do ${mesmoNumero.nome}. Escolha outro.`);
            if (!e.itens.length) return mostrarErro(r, 'Adicione pelo menos um insumo.');
            if (e.itens.some((it) => !it.insumoId)) return mostrarErro(r, 'Escolha o insumo de cada linha.');
            if (e.itens.some((it) => !(it.kg > 0))) return mostrarErro(r, 'Preencha os kg de cada insumo.');
            const repetido = e.itens.find((it, k) => e.itens.findIndex((x) => x.insumoId === it.insumoId) !== k);
            if (repetido) return mostrarErro(r, `${porId[repetido.insumoId].nome} está repetido. Junte numa linha só.`);
            if (!e.tipo) return mostrarErro(r, 'Escolha o tipo: sal mineral, proteinado ou outro.');
            const prontoPreco = lerNumero(r.querySelector('#pronto-preco').value);
            const prontoKg = lerNumero(r.querySelector('#pronto-kg').value);
            if ((prontoPreco !== null || prontoKg !== null) && !(prontoPreco > 0 && prontoKg > 0)) {
              return mostrarErro(r, 'Para comparar com o sal pronto, preencha o preço e o kg do saco (ou deixe os dois em branco).');
            }
            // Passou do limite de algum insumo: o dono precisa confirmar (2º toque em "CONFIRMAR E SALVAR")
            const violacoes = C().passaLimite(e.itens, porId);
            const chave = JSON.stringify(violacoes);
            if (violacoes.length && e.confirmaLimite !== chave) {
              e.confirmaLimite = chave;
              b.className = 'btn vermelho grande';
              b.innerHTML = `${ic('atencao', 40, 2.6)} CONFIRMAR E SALVAR`;
              r.querySelector('#limite').scrollIntoView({ block: 'center', behavior: 'smooth' });
              A.voz.falar('Atenção. ' + violacoes.map((x) => `${x.nome}: ${C().numero(x.pct)} por cento, o limite é ${C().numero(x.max)} por cento.`).join(' ') + ' Para salvar assim, toque de novo em confirmar e salvar.');
              return;
            }

            b.disabled = true;
            const registro = Object.assign(atual || { id: A.db.novoId('formula'), criadoEm: new Date().toISOString() }, {
              nome, numero, cor: e.cor, corClara: e.corClara, foto: e.foto || null,
              itens: e.itens.map((it) => ({ insumoId: it.insumoId, kg: Math.round(it.kg * 10) / 10 })),
              // Sem tamanhos cadastrados: a batida é o total da receita (como era antes)
              tamanhos: e.tamanhosAuto ? [] : e.tamanhos.slice(),
              tamanhoPadrao: e.tamanhosAuto ? null : padraoAtual(),
              tipo: e.tipo,
              epoca: e.epoca,
              prontoPrecoSaco: prontoPreco > 0 ? prontoPreco : null,
              prontoKgSaco: prontoKg > 0 ? prontoKg : null,
              // O que o dono confirmou ao salvar acima do limite (a mistura confere de novo ao começar)
              limitesConfirmados: violacoes.map((x) => ({ insumoId: x.insumoId, pct: x.pct, max: x.max })),
              limiteConfirmadoEm: violacoes.length ? new Date().toISOString() : null,
              exemplo: false,
            });
            await A.db.salvar('formulas', registro);
            await A.ir('formulas');
            A.mostrarAviso(nome + ' salvo');
          });

          U().ao(r, '[data-acao=apagar]', async () => {
            if (!confirm(`Apagar a fórmula ${atual.nome}? As misturas já feitas continuam no histórico.`)) return;
            await A.db.apagar('formulas', atual.id);
            await A.ir('formulas');
            A.mostrarAviso(atual.nome + ' apagada');
          });
        },
      };
    },

    // ---------- PASTOS ----------

    async pastos() {
      const [lista, formulas] = await Promise.all([A.db.todos('pastos'), A.db.todos('formulas')]);
      lista.sort((a, b) => a.numero - b.numero);
      const fPorId = U().porId(formulas);
      const salTexto = (id) => (fPorId[id] ? `Sal ${fPorId[id].numero}` : '—');
      return {
        fala: 'Pastos e lotes. Toque num pasto para mudar, ou em novo pasto.',
        html: `
<main class="tela">
  ${topo('PASTOS E LOTES')}
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVO PASTO</button>
  ${lista.map((p) => `
  <button class="item-cad" data-id="${esc(p.id)}">
    ${p.foto ? miniatura(p.foto) : `<span class="mini-cad numero-cad" style="background:${p.cor}">${p.numero}</span>`}
    <span class="item-texto"><b>Pasto ${p.numero} · ${esc(p.nome)}</b><small>${p.cabecas || 0} cabeças · Águas: ${esc(salTexto(p.formulaAguasId))} · Seca: ${esc(salTexto(p.formulaSecaId))}</small></span>
    ${etiquetaExemplo(p)}
  </button>`).join('') || '<p class="vazio">Nenhum pasto cadastrado.</p>'}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=novo]', () => A.ir('pasto', {}));
          U().ao(r, '[data-id]', (b) => A.ir('pasto', { id: b.dataset.id }));
        },
      };
    },

    async pasto({ id }) {
      const [atual, todos, formulas] = await Promise.all([
        id ? A.db.pegar('pastos', id) : null, A.db.todos('pastos'), A.db.todos('formulas'),
      ]);
      formulas.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      const proximo = todos.reduce((m, p) => Math.max(m, p.numero || 0), 0) + 1;
      // Lista de sais para escolher; mostra a época de cada um para ajudar (não bloqueia)
      const opcoesSal = (sel) => '<option value="">Nenhum (não sugerir)</option>' + formulas.map((f) =>
        `<option value="${esc(f.id)}"${f.id === sel ? ' selected' : ''}>Sal ${f.numero} · ${esc(f.nome)} (${C().EPOCAS[C().epocaDaFormula(f)].nome.toLowerCase()})</option>`).join('');
      const e = atual
        ? { cor: atual.cor, corClara: atual.corClara, foto: atual.foto || null }
        : { cor: CORES_FORTES[(proximo - 1) % CORES_FORTES.length][0], corClara: CORES_FORTES[(proximo - 1) % CORES_FORTES.length][1], foto: null };
      return {
        fala: atual ? `Editar pasto ${atual.numero}.` : 'Novo pasto. Escreva o nome, o número e quantas cabeças tem.',
        html: `
<main class="tela">
  ${topo(atual ? 'EDITAR PASTO' : 'NOVO PASTO')}
  <label class="rotulo" for="nome">Nome do pasto ou lote</label>
  <input id="nome" class="campo" type="text" autocomplete="off" autocapitalize="sentences" maxlength="30" placeholder="Ex.: Vacas" value="${esc(atual ? atual.nome : '')}">
  ${campoNumero('numero', 'Número (o operador vê no cartão)', atual ? atual.numero : proximo, '')}
  ${campoNumero('cabecas', 'Quantas cabeças', atual ? atual.cabecas : '', 'cabeças')}
  <label class="rotulo" for="sal-aguas">${ic('gota', 24, 2.2)} Sal das águas</label>
  <select id="sal-aguas" class="campo">${opcoesSal(atual && atual.formulaAguasId)}</select>
  <label class="rotulo" for="sal-seca">${ic('sol', 24, 2.2)} Sal da seca</label>
  <select id="sal-seca" class="campo">${opcoesSal(atual && atual.formulaSecaId)}</select>
  <p class="ajuda">Conforme a época marcada na Área do dono, o operador vê no destino qual sal este lote recebe.</p>
  <div class="rotulo">Consumo esperado (meta do técnico, opcional)</div>
  <div class="grade-2">
    <div>${campoNumero('meta-aguas', 'Nas águas', atual ? atual.metaAguasG : null, 'g/cab/dia')}</div>
    <div>${campoNumero('meta-seca', 'Na seca', atual ? atual.metaSecaG : null, 'g/cab/dia')}</div>
  </div>
  <p class="ajuda">O Painel compara o consumo por cabeça com a meta da época marcada: até 10% de diferença = dentro; mais = acima ou abaixo (amarelo).</p>
  <div class="rotulo">Cor do cartão</div>
  ${seletorCores(CORES_FORTES, e.cor)}
  <div class="rotulo">Foto do pasto (opcional)</div>
  ${botaoFoto(e.foto, 'FOTO DO PASTO')}
  ${erroHtml()}
  <button class="btn verde grande" data-acao="salvar">${ic('certo', 44, 3)} SALVAR</button>
  ${atual ? `<button class="btn" data-acao="apagar">${ic('problema', 28)} Apagar pasto</button>` : ''}
</main>`,
        ligar(r) {
          ligarFoto(r, e);
          ligarCores(r, (k) => { e.cor = CORES_FORTES[k][0]; e.corClara = CORES_FORTES[k][1]; });
          U().ao(r, '[data-acao=voltar]', () => A.ir('pastos'));
          U().ao(r, '[data-acao=salvar]', async (b) => {
            const nome = r.querySelector('#nome').value.trim().replace(/\s+/g, ' ');
            const numero = lerNumero(r.querySelector('#numero').value);
            const cabecas = lerNumero(r.querySelector('#cabecas').value);
            if (!nome) return mostrarErro(r, 'Escreva o nome do pasto.');
            if (!(Number.isInteger(numero) && numero >= 1)) return mostrarErro(r, 'O número precisa ser 1, 2, 3...');
            const mesmo = todos.find((p) => p.id !== (atual && atual.id) && p.numero === numero);
            if (mesmo) return mostrarErro(r, `O número ${numero} já é do pasto ${mesmo.nome}. Escolha outro.`);
            if (!(Number.isInteger(cabecas) && cabecas >= 0)) return mostrarErro(r, 'Diga quantas cabeças tem (número inteiro).');
            const metaAguasG = lerNumero(r.querySelector('#meta-aguas').value);
            const metaSecaG = lerNumero(r.querySelector('#meta-seca').value);
            if ((metaAguasG !== null && !(metaAguasG > 0)) || (metaSecaG !== null && !(metaSecaG > 0))) {
              return mostrarErro(r, 'A meta de consumo precisa ser um número maior que zero (ou fique em branco).');
            }
            b.disabled = true;
            const registro = Object.assign(atual || { id: A.db.novoId('pasto'), criadoEm: new Date().toISOString() }, {
              nome, numero, cabecas, cor: e.cor, corClara: e.corClara, foto: e.foto || null, exemplo: false,
              formulaAguasId: r.querySelector('#sal-aguas').value || null,
              formulaSecaId: r.querySelector('#sal-seca').value || null,
              metaAguasG, metaSecaG,
            });
            await A.db.salvar('pastos', registro);
            await A.ir('pastos');
            A.mostrarAviso('Pasto ' + numero + ' salvo');
          });
          U().ao(r, '[data-acao=apagar]', async () => {
            if (!confirm(`Apagar o pasto ${atual.numero} (${atual.nome})? As misturas já mandadas para ele continuam no histórico.`)) return;
            await A.db.apagar('pastos', atual.id);
            await A.ir('pastos');
            A.mostrarAviso('Pasto apagado');
          });
        },
      };
    },

    // ---------- PESSOAS ----------

    async pessoas() {
      const todas = (await A.db.todos('pessoas')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const ativas = todas.filter((p) => p.ativo !== false);
      const fora = todas.filter((p) => p.ativo === false);
      return {
        fala: 'Pessoas. Toque numa pessoa para mudar.',
        html: `
<main class="tela">
  ${topo('PESSOAS')}
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVA PESSOA</button>
  ${ativas.map((p) => `
  <button class="item-cad" data-id="${esc(p.id)}">
    ${U().avatar(p, 56)}
    <span class="item-texto"><b>${esc(p.nome)}</b><small>${p.funcao === 'dono' ? 'Dono' : 'Operador'}</small></span>
    ${etiquetaExemplo(p)}
  </button>`).join('') || '<p class="vazio">Ninguém na lista.</p>'}
  ${fora.length ? `
  <section class="secao">
    <h2>Fora da lista "Quem é você?"</h2>
    <ul class="lista">${fora.map((p) => `<li class="linha-fora"><span>${esc(p.nome)}</span>
      <button class="btn-pequeno largo" data-voltar-lista="${esc(p.id)}">Pôr de volta</button></li>`).join('')}</ul>
  </section>` : ''}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=novo]', () => A.ir('novaPessoa', { volta: 'pessoas', dono: true }));
          U().ao(r, '[data-id]', (b) => A.ir('novaPessoa', { id: b.dataset.id, volta: 'pessoas', dono: true }));
          U().ao(r, '[data-voltar-lista]', async (b) => {
            const p = fora.find((x) => x.id === b.dataset.voltarLista);
            await A.db.salvar('pessoas', Object.assign({}, p, { ativo: true }));
            await A.ir('pessoas');
            A.mostrarAviso(p.nome + ' voltou para a lista');
          });
        },
      };
    },

    // ---------- DADOS DE EXEMPLO ----------

    async exemplos() {
      const contar = async (n) => (await A.db.todos(n)).filter((x) => x.exemplo).length;
      const [ins, form, pas, pes, mis] = await Promise.all(['insumos', 'formulas', 'pastos', 'pessoas', 'misturas'].map(contar));
      const total = ins + form + pas + pes + mis;
      return {
        fala: 'Dados de exemplo. Aqui você apaga os exemplos ou recomeça a demonstração.',
        html: `
<main class="tela">
  ${topo('DADOS DE EXEMPLO')}
  <section class="secao">
    <h2>Exemplos neste celular</h2>
    ${total ? `<ul class="lista">
      <li>${ins} insumos · ${form} fórmulas · ${pas} pastos</li>
      <li>${pes} pessoas · ${mis} misturas de exemplo</li>
    </ul>` : '<p>Nenhum dado de exemplo. Tudo aqui é cadastro de verdade.</p>'}
  </section>
  <section class="secao">
    <h2>Apagar dados de exemplo</h2>
    <p>Some tudo o que tem a etiqueta "exemplo". O que você cadastrou ou editou continua.</p>
    <p>Se uma fórmula sua usa um insumo de exemplo, esse insumo fica e passa a ser seu.</p>
  </section>
  <button class="btn vermelho" data-acao="apagar" ${total ? '' : 'disabled'}>${ic('problema', 28)} APAGAR DADOS DE EXEMPLO</button>
  <section class="secao">
    <h2>Recomeçar demonstração</h2>
    <p>Apaga <b>tudo</b> deste celular (inclusive o que você cadastrou e as misturas feitas) e coloca os exemplos de novo. A senha continua a mesma.</p>
  </section>
  <button class="btn" data-acao="recomecar">Recomeçar demonstração</button>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=apagar]', async () => {
            if (!confirm('Apagar os dados de exemplo? O que é seu continua.')) return;
            const mantidos = await A.exemplo.apagar();
            if (A.estado.pessoa && A.estado.pessoa.exemplo) A.estado.pessoa = null;
            await A.ir('dono');
            A.mostrarAviso(mantidos.length
              ? `Exemplos apagados. Ficaram (usados nas suas fórmulas): ${mantidos.join(', ')}`
              : 'Exemplos apagados');
          });
          U().ao(r, '[data-acao=recomecar]', async () => {
            if (!confirm('Apagar TUDO deste celular e colocar os exemplos de novo? Isso não tem volta.')) return;
            await A.exemplo.recomecar();
            A.estado.pessoa = null;
            A.estado.donoLiberado = false;
            await A.ir('quem');
            A.mostrarAviso('Demonstração recomeçada');
          });
        },
      };
    },
  });
})();
