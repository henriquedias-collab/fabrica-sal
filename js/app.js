// Liga tudo: abre o banco, coloca os exemplos, troca as telas.
window.App = window.App || {};

(function () {
  const A = App;

  A.estado = {
    pessoa: null, // quem está usando o app agora
    mistura: null, // mistura em andamento (fórmula, passo atual, início)
    fala: '', // texto que o alto-falante lê na tela atual
  };

  // Mostra uma tela
  A.ir = async function (nome, params) {
    A.voz.parar();
    if (['inicio', 'escolher', 'aviso', 'passo', 'destino', 'pronta'].includes(nome) && !A.estado.pessoa) nome = 'quem';
    if (['aviso', 'passo', 'destino'].includes(nome) && !A.estado.mistura) nome = 'inicio';
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

  async function iniciar() {
    try {
      await A.db.abrir();
      await A.exemplo.semearSePreciso();
      const atual = await A.db.config('pessoaAtual');
      if (atual) {
        const p = await A.db.pegar('pessoas', atual);
        if (p && p.ativo !== false) A.estado.pessoa = p;
      }
      await A.ir(A.estado.pessoa ? 'inicio' : 'quem');
    } catch (e) {
      console.error(e);
      document.getElementById('app').innerHTML =
        '<main class="tela carregando"><p>Não foi possível abrir o app neste navegador.</p><p style="font-size:16px">' +
        A.ui.esc(e && e.message) + '</p></main>';
    }
  }

  // Funcionar sem internet (só quando aberto por um endereço http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker:', e));
  }
  // Pede ao navegador para não apagar os dados do app quando faltar espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  iniciar();
})();
