// Liga tudo: abre o banco, coloca os exemplos, troca as telas.
window.App = window.App || {};

(function () {
  const A = App;

  A.estado = {
    pessoa: null, // quem está usando o app agora
    mistura: null, // mistura em andamento (fórmula, passo atual, início)
    fala: '', // texto que o alto-falante lê na tela atual
  };

  // Telas da Área do dono: só abrem depois da senha. Ao voltar para as telas do operador, trava de novo.
  const TELAS_DONO = ['dono', 'registros', 'insumos', 'insumo', 'formulas', 'formula', 'pastos', 'pasto', 'pessoas', 'exemplos', 'trocarSenha', 'exportarCopia', 'importarCopia', 'painel', 'contarEstoque', 'epoca', 'precos', 'resumo', 'perda'];

  // Mostra uma tela
  A.ir = async function (nome, params) {
    if (A.estado.versaoNova && (nome === 'inicio' || nome === 'quem')) {
      location.reload();
      return;
    }
    A.voz.parar();
    const doDono = TELAS_DONO.includes(nome) || !!(params && params.dono);
    if (doDono && !A.estado.donoLiberado) {
      params = { destino: nome, params: params || {} };
      nome = 'senha';
    } else if (!doDono && nome !== 'senha') {
      A.estado.donoLiberado = false;
    }
    if (['inicio', 'escolher', 'tamanho', 'limite', 'aviso', 'passo', 'destino', 'outroSal', 'pronta', 'sairMistura', 'chegada', 'chegadaContar', 'chegadaPronta', 'problema', 'problemaInsumo', 'problemaDetalhe', 'problemaPronto'].includes(nome) && !A.estado.pessoa) nome = 'quem';
    if (['aviso', 'passo', 'destino', 'outroSal', 'sairMistura'].includes(nome) && !A.estado.mistura) nome = 'inicio';
    const tela = await A.telas[nome](params || {});
    const raiz = document.getElementById('app');
    raiz.innerHTML = tela.html;
    document.body.classList.toggle('verde', tela.tom === 'verde');
    A.estado.fala = tela.fala || '';
    raiz.querySelectorAll('[data-falar]').forEach((b) => {
      b.addEventListener('click', () => A.voz.alternar(A.estado.fala, b));
    });
    if (tela.ligar) tela.ligar(raiz);
    window.scrollTo(0, 0);
  };

  // Mensagem rápida no rodapé (some sozinha)
  let tempoAviso = null;
  A.mostrarAviso = function (texto, tipo) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast' + (tipo ? ' ' + tipo : '');
    t.setAttribute('role', 'status');
    t.innerHTML = A.ui.ic(tipo === 'laranja' ? 'atencao' : 'certo', 30, 2.6) + '<span></span>';
    t.querySelector('span').textContent = texto;
    document.body.appendChild(t);
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => t.remove(), 3500);
  };

  // Se algum arquivo do app não baixou (ex.: o servidor falhou logo depois de uma publicação),
  // recarrega sozinho uma vez antes de mostrar o erro.
  function arquivosOk() {
    const faltando = ['db', 'calc', 'exemplo', 'voz', 'telas', 'ui'].filter((k) => !A[k]);
    let jaTentou = false;
    try { jaTentou = sessionStorage.getItem('fabricaRecarregou') === '1'; } catch (e) { /* sem sessionStorage */ }
    if (!faltando.length) {
      try { sessionStorage.removeItem('fabricaRecarregou'); } catch (e) { /* ok */ }
      return true;
    }
    if (!jaTentou) {
      try { sessionStorage.setItem('fabricaRecarregou', '1'); } catch (e) { /* ok */ }
      location.reload();
      return false;
    }
    throw new Error('Parte do app não baixou (' + faltando.join(', ') + '). Confira a internet e abra o app de novo.');
  }

  async function iniciar() {
    try {
      if (!arquivosOk()) return;
      await A.db.abrir();
      await A.exemplo.semearSePreciso();
      await A.calc.converterPrecosParaKg(); // preço por saco (antigo) -> R$/kg, uma vez só
      const atual = await A.db.config('pessoaAtual');
      if (atual) {
        const p = await A.db.pegar('pessoas', atual);
        if (p && p.ativo !== false) A.estado.pessoa = p;
      }
      await A.ir(A.estado.pessoa ? 'inicio' : 'quem');
    } catch (e) {
      console.error(e);
      document.getElementById('app').innerHTML =
        '<main class="tela carregando"><p>Não foi possível abrir o app.</p><p style="font-size:16px"></p></main>';
      document.querySelector('#app p + p').textContent = (e && e.message) || '';
    }
  }

  // Funcionar sem internet (só quando aberto por um endereço http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const tinhaVersao = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker:', e));
    // Chegou versão nova do app: recarrega quando a pessoa voltar ao Início (nunca no meio de uma mistura)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (tinhaVersao) A.estado.versaoNova = true;
    });
  }
  // Pede ao navegador para não apagar os dados do app quando faltar espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  iniciar();
})();
