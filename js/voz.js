// Leitura em voz alta das instruções (voz do próprio aparelho, em português).
window.App = window.App || {};

(function () {
  const sintese = window.speechSynthesis;
  let vozPt = null;
  let botaoAtivo = null;

  function escolherVoz() {
    if (!sintese) return;
    const vozes = sintese.getVoices();
    vozPt = vozes.find((v) => /^pt[-_]BR$/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang)) || null;
  }
  if (sintese) {
    escolherVoz();
    sintese.onvoiceschanged = escolherVoz;
  }

  function marcar(botao, ligado) {
    if (!botao) return;
    botao.classList.toggle('falando', ligado);
    botao.setAttribute('aria-pressed', ligado ? 'true' : 'false');
  }

  App.voz = {
    falar(texto, botao) {
      if (!texto) return;
      if (!sintese) {
        App.mostrarAviso('Este aparelho não tem voz', 'laranja');
        return;
      }
      sintese.cancel();
      marcar(botaoAtivo, false);
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (vozPt) u.voice = vozPt;
      u.rate = 0.9;
      botaoAtivo = botao || null;
      marcar(botaoAtivo, true);
      u.onend = u.onerror = () => {
        marcar(botao, false);
        if (botaoAtivo === botao) botaoAtivo = null;
      };
      sintese.speak(u);
    },

    // Toque no alto-falante: fala; se já estiver falando, para
    alternar(texto, botao) {
      if (sintese && sintese.speaking && botaoAtivo === botao) this.parar();
      else this.falar(texto, botao);
    },

    parar() {
      if (sintese) sintese.cancel();
      marcar(botaoAtivo, false);
      botaoAtivo = null;
    },
  };
})();
