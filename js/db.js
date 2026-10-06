// Banco de dados no próprio celular (IndexedDB).
// Cada "loja" guarda um tipo de registro. A loja "config" guarda valores soltos (ex.: quem está usando).
window.App = window.App || {};

(function () {
  const NOME = 'fabrica-sal';
  const VERSAO = 1;
  const LOJAS = ['pessoas', 'insumos', 'formulas', 'pastos', 'misturas', 'problemas'];
  let banco = null;

  function pedido(r) {
    return new Promise((ok, erro) => {
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
  }

  function loja(nome, modo) {
    return banco.transaction(nome, modo || 'readonly').objectStore(nome);
  }

  App.db = {
    LOJAS,

    abrir() {
      return new Promise((ok, erro) => {
        const r = indexedDB.open(NOME, VERSAO);
        r.onupgradeneeded = () => {
          const d = r.result;
          LOJAS.forEach((n) => {
            if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' });
          });
          if (!d.objectStoreNames.contains('config')) d.createObjectStore('config', { keyPath: 'chave' });
        };
        r.onsuccess = () => { banco = r.result; ok(banco); };
        r.onerror = () => erro(r.error);
      });
    },

    todos(nome) { return pedido(loja(nome).getAll()); },
    pegar(nome, id) { return pedido(loja(nome).get(id)); },
    salvar(nome, obj) { return pedido(loja(nome, 'readwrite').put(obj)); },
    apagar(nome, id) { return pedido(loja(nome, 'readwrite').delete(id)); },
    limpar(nome) { return pedido(loja(nome, 'readwrite').clear()); },

    // Grava em várias lojas de uma vez: ou grava tudo, ou nada.
    // trabalho(l) recebe uma função l('nomeDaLoja') que devolve a loja para usar .put / .delete.
    transacao(nomes, trabalho) {
      return new Promise((ok, erro) => {
        const t = banco.transaction(nomes, 'readwrite');
        trabalho((n) => t.objectStore(n));
        t.oncomplete = () => ok();
        t.onerror = () => erro(t.error);
        t.onabort = () => erro(t.error);
      });
    },

    async config(chave) {
      const r = await this.pegar('config', chave);
      return r ? r.valor : undefined;
    },
    definir(chave, valor) { return this.salvar('config', { chave, valor }); },

    novoId(prefixo) {
      return prefixo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    },
  };
})();
