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
      return {
        fala: 'Área do dono. Escolha o que quer cadastrar ou conferir.',
        html: `
<main class="tela">
  ${topo('ÁREA DO DONO')}
  ${avisoCopia}
  <button class="btn-menu painel-menu" data-ir="painel">${ic('grafico', 40, 2.2)}<span>Painel<small>Produção, estoque, consumo, compras e problemas</small></span>${ic('seguir', 28, 2.4)}</button>
  <button class="btn" data-ir="exportarCopia">${ic('baixar', 32, 2.4)} EXPORTAR CÓPIA</button>
  <button class="btn" data-acao="importar">${ic('abrir', 32, 2.4)} IMPORTAR CÓPIA</button>
  ${item('insumos', 'saco', 'Insumos', n(insumos, 'cadastrado', 'cadastrados'))}
  ${item('formulas', 'misturar', 'Fórmulas', n(formulas, 'cadastrada', 'cadastradas'))}
  ${item('pastos', 'pasto', 'Pastos e lotes', n(pastos, 'cadastrado', 'cadastrados'))}
  ${item('pessoas', 'pessoa', 'Pessoas', n(pessoas.filter((p) => p.ativo !== false), 'na lista', 'na lista'))}
  ${item('registros', 'mensagem', 'Registros', 'Misturas, chegadas, problemas e estoque')}
  ${item('exemplos', 'ajustes', 'Dados de exemplo', 'Apagar ou recomeçar a demonstração')}
  ${item('trocarSenha', 'chave', 'Trocar a senha', 'Senha de 4 números')}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir(A.estado.pessoa ? 'inicio' : 'quem'));
          U().ao(r, '[data-ir]', (b) => A.ir(b.dataset.ir));
          U().ao(r, '[data-acao=importar]', () => A.copia.escolherArquivo());
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
  ${lista.map((i) => `
  <button class="item-cad" data-id="${esc(i.id)}">
    ${miniatura(i.foto, i.cor, i.corTexto, 'saco')}
    <span class="item-texto"><b>${esc(i.nome)}</b>
      <small>Estoque: ${esc(C().qtdTexto(i.estoqueKg, i))} · mínimo ${esc(C().qtdTexto(i.estoqueMinimoKg || 0, i))}</small></span>
    ${etiquetaExemplo(i)}
  </button>`).join('') || '<p class="vazio">Nenhum insumo cadastrado.</p>'}
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=novo]', () => A.ir('insumo', {}));
          U().ao(r, '[data-id]', (b) => A.ir('insumo', { id: b.dataset.id }));
        },
      };
    },

    async insumo({ id }) {
      const atual = id ? await A.db.pegar('insumos', id) : null;
      const estoqueAntes = atual ? atual.estoqueKg : 0; // para registrar a correção de estoque
      const e = atual
        ? Object.assign({}, atual, { unidade: atual.unidade || 'saco' })
        : { nome: '', cor: CORES_INSUMO[0][0], corTexto: CORES_INSUMO[0][1], unidade: 'saco', kgPorSaco: 50, estoqueKg: 0, estoqueMinimoKg: 0, precoPorUnidade: null, foto: null };
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
    ${campoNumero('kg-por', 'Quantos kg em cada <span data-un="um">saco</span>?', granel() ? '' : e.kgPorSaco, 'kg')}
  </div>
  ${campoNumero('estoque', 'Estoque agora', emUnidades(e.estoqueKg), '<span data-un="varios">sacos</span>', ' ')}
  ${campoNumero('minimo', 'Estoque mínimo (avisa quando ficar abaixo)', emUnidades(e.estoqueMinimoKg || 0), '<span data-un="varios">sacos</span>', ' ')}
  ${campoNumero('preco', 'Preço de cada <span data-un="um">saco</span> (opcional)', e.precoPorUnidade, 'R$')}
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

            b.disabled = true;
            const paraKg = (v) => Math.round((g ? v : v * kgPor) * 10) / 10;
            const registro = Object.assign(atual || { id: A.db.novoId('insumo'), criadoEm: new Date().toISOString() }, {
              nome, foto: e.foto || null, cor: e.cor, corTexto: e.corTexto, unidade: e.unidade, kgPorSaco: kgPor,
              estoqueKg: paraKg(estoque), estoqueMinimoKg: paraKg(minimo || 0), precoPorUnidade: preco,
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
      return {
        fala: 'Fórmulas. Toque numa fórmula para mudar, ou em nova fórmula.',
        html: `
<main class="tela">
  ${topo('FÓRMULAS')}
  <p class="ajuda">As quantidades vêm do técnico ou nutricionista. O app só segue a fórmula e registra.</p>
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVA FÓRMULA</button>
  ${lista.map((f) => {
    const total = f.itens.reduce((s, it) => s + it.kg, 0);
    const quebrada = f.itens.some((it) => !ids.has(it.insumoId));
    return `
  <button class="item-cad" data-id="${esc(f.id)}">
    ${miniatura(f.foto, f.corClara, f.cor, 'misturar')}
    <span class="item-texto"><b>${f.numero} · ${esc(f.nome)}</b>
      <small>${f.itens.length} ${f.itens.length === 1 ? 'insumo' : 'insumos'} · ${C().numero(total)} kg por batida</small></span>
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
      const [atual, insumos, todas] = await Promise.all([
        id ? A.db.pegar('formulas', id) : null, A.db.todos('insumos'), A.db.todos('formulas'),
      ]);
      insumos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const porId = U().porId(insumos);
      const proximoNumero = todas.reduce((m, f) => Math.max(m, f.numero || 0), 0) + 1;
      const e = atual
        ? { nome: atual.nome, numero: atual.numero, cor: atual.cor, corClara: atual.corClara, foto: atual.foto || null, itens: atual.itens.map((it) => Object.assign({}, it)) }
        : { nome: '', numero: proximoNumero, cor: CORES_FORTES[0][0], corClara: CORES_FORTES[0][1], foto: null, itens: [] };

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
  <div class="rotulo">Insumos de uma batida (na ordem sugerida)</div>
  <div id="itens" class="itens"></div>
  <button class="btn" data-acao="adicionar">${ic('mais', 30, 2.6)} ADICIONAR INSUMO</button>
  <p class="total-batida" id="total"></p>
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
          ligarFoto(r, e);
          ligarCores(r, (k) => { e.cor = CORES_FORTES[k][0]; e.corClara = CORES_FORTES[k][1]; });

          const mostrarTotal = () => {
            const total = e.itens.reduce((s, it) => s + (it.kg > 0 ? it.kg : 0), 0);
            r.querySelector('#total').textContent = e.itens.length ? `Total de uma batida: ${C().numero(total)} kg` : '';
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

            b.disabled = true;
            const registro = Object.assign(atual || { id: A.db.novoId('formula'), criadoEm: new Date().toISOString() }, {
              nome, numero, cor: e.cor, corClara: e.corClara, foto: e.foto || null,
              itens: e.itens.map((it) => ({ insumoId: it.insumoId, kg: Math.round(it.kg * 10) / 10 })),
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
      const lista = (await A.db.todos('pastos')).sort((a, b) => a.numero - b.numero);
      return {
        fala: 'Pastos e lotes. Toque num pasto para mudar, ou em novo pasto.',
        html: `
<main class="tela">
  ${topo('PASTOS E LOTES')}
  <button class="btn verde" data-acao="novo">${ic('mais', 34, 2.6)} NOVO PASTO</button>
  ${lista.map((p) => `
  <button class="item-cad" data-id="${esc(p.id)}">
    ${p.foto ? miniatura(p.foto) : `<span class="mini-cad numero-cad" style="background:${p.cor}">${p.numero}</span>`}
    <span class="item-texto"><b>Pasto ${p.numero} · ${esc(p.nome)}</b><small>${p.cabecas || 0} cabeças</small></span>
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
      const [atual, todos] = await Promise.all([id ? A.db.pegar('pastos', id) : null, A.db.todos('pastos')]);
      const proximo = todos.reduce((m, p) => Math.max(m, p.numero || 0), 0) + 1;
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
            b.disabled = true;
            const registro = Object.assign(atual || { id: A.db.novoId('pasto'), criadoEm: new Date().toISOString() }, {
              nome, numero, cabecas, cor: e.cor, corClara: e.corClara, foto: e.foto || null, exemplo: false,
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
