// Dados de demonstração. Tudo tem exemplo: true e id começando com "ex-",
// para poder apagar de uma vez (Área do dono > Apagar dados de exemplo).
// ATENÇÃO: as fórmulas abaixo são só para testar o app, não são recomendação nutricional.
window.App = window.App || {};

(function () {
  const pessoas = [
    { id: 'ex-ze', nome: 'Zé', funcao: 'operador', cor: '#1d6b3a' },
    { id: 'ex-antonio', nome: 'Antônio', funcao: 'operador', cor: '#1f4fa0' },
  ];

  // estoqueKg = estoque estimado agora; cai a cada mistura salva
  const insumos = [
    { id: 'ex-sal', nome: 'Sal comum', cor: '#e9e7e1', corTexto: '#3d3a33', unidade: 'saco', kgPorSaco: 25, estoqueKg: 3000, estoqueMinimoKg: 1000 },
    { id: 'ex-nucleo', nome: 'Núcleo mineral', cor: '#e2d6ee', corTexto: '#4b2f73', unidade: 'saco', kgPorSaco: 30, estoqueKg: 1500, estoqueMinimoKg: 300 },
    { id: 'ex-farelo', nome: 'Farelo de soja', cor: '#ecd3a2', corTexto: '#6b4a12', unidade: 'saco', kgPorSaco: 50, estoqueKg: 100, estoqueMinimoKg: 200 },
    { id: 'ex-ureia', nome: 'Ureia', cor: '#dfe7f2', corTexto: '#1f3f6e', unidade: 'saco', kgPorSaco: 50, estoqueKg: 100, estoqueMinimoKg: 150 },
  ];

  // itens: kg de cada insumo por batida, na ordem em que entram no misturador
  const formulas = [
    {
      id: 'ex-mineral', nome: 'Sal mineral', numero: 1, cor: '#1f4fa0', corClara: '#dbe5f5',
      itens: [{ insumoId: 'ex-sal', kg: 350 }, { insumoId: 'ex-nucleo', kg: 150 }],
    },
    {
      id: 'ex-proteinado', nome: 'Proteinado', numero: 2, cor: '#a65300', corClara: '#f8e2c9',
      itens: [
        { insumoId: 'ex-farelo', kg: 200 },
        { insumoId: 'ex-sal', kg: 150 },
        { insumoId: 'ex-nucleo', kg: 100 },
        { insumoId: 'ex-ureia', kg: 50 },
      ],
    },
  ];

  const pastos = [
    { id: 'ex-pasto-1', numero: 1, nome: 'Vacas', cor: '#1d6b3a', corClara: '#d6e8dc', cabecas: 120 },
    { id: 'ex-pasto-2', numero: 2, nome: 'Novilhas', cor: '#1f4fa0', corClara: '#dbe5f5', cabecas: 80 },
    { id: 'ex-pasto-3', numero: 3, nome: 'Garrotes', cor: '#a65300', corClara: '#f8e2c9', cabecas: 60 },
    { id: 'ex-pasto-4', numero: 4, nome: 'Bezerros', cor: '#5b3a8a', corClara: '#e6dcf2', cabecas: 50 },
  ];

  // Histórico de 14 dias: 1 sal mineral por dia e 1 proteinado a cada 2 dias.
  // Serve para o alerta de "estoque em dias" já ter números na demonstração.
  function historico() {
    const porId = {};
    insumos.forEach((i) => { porId[i.id] = i; });
    const lista = [];
    const agora = Date.now();
    for (let d = 14; d >= 1; d--) {
      const dia = new Date(agora - d * App.calc.DIA);
      const base = dia.setHours(8, 10 + (d % 5) * 7, 0, 0); // de manhã, por volta das 8h
      const quem = pessoas[d % 2];
      const p1 = pastos[d % 4];
      lista.push(App.calc.montarMistura({
        formula: formulas[0], insumosPorId: porId, pessoa: quem, exemplo: true,
        destino: { tipo: 'pasto', id: p1.id, numero: p1.numero, nome: p1.nome },
        inicio: new Date(base).toISOString(), fim: new Date(base + 25 * 60 * 1000).toISOString(),
      }));
      if (d % 2 === 0) {
        const p2 = pastos[(d + 1) % 4];
        const b2 = base + 6 * 60 * 60 * 1000; // à tarde
        lista.push(App.calc.montarMistura({
          formula: formulas[1], insumosPorId: porId, pessoa: quem, exemplo: true,
          destino: { tipo: 'pasto', id: p2.id, numero: p2.numero, nome: p2.nome },
          inicio: new Date(b2).toISOString(), fim: new Date(b2 + 30 * 60 * 1000).toISOString(),
        }));
      }
    }
    lista.forEach((m, k) => { m.id = 'ex-mistura-' + k; });
    return lista;
  }

  function marcar(lista) {
    return lista.map((x) => Object.assign({}, x, { exemplo: true }));
  }

  async function semear() {
    const dados = {
      pessoas: marcar(pessoas).map((p) => Object.assign(p, { ativo: true, foto: null })),
      insumos: marcar(insumos),
      formulas: marcar(formulas),
      pastos: marcar(pastos),
      misturas: historico(),
    };
    const nomes = Object.keys(dados).concat('config');
    await App.db.transacao(nomes, (l) => {
      Object.keys(dados).forEach((n) => dados[n].forEach((x) => l(n).put(x)));
      l('config').put({ chave: 'exemploCarregado', valor: new Date().toISOString() });
    });
  }

  App.exemplo = {
    // Na primeira vez que o app abre, coloca os dados de exemplo
    async semearSePreciso() {
      if (await App.db.config('exemploCarregado')) return;
      await semear();
    },

    // Apaga só o que é exemplo; o que foi cadastrado de verdade fica.
    // Insumo de exemplo usado numa fórmula de verdade é mantido e vira cadastro de verdade.
    // Devolve os nomes dos insumos mantidos.
    async apagar() {
      const formulas = await App.db.todos('formulas');
      const usados = new Set();
      formulas.filter((f) => !f.exemplo).forEach((f) => f.itens.forEach((it) => usados.add(it.insumoId)));
      const mantidos = [];
      for (const n of App.db.LOJAS) {
        const todos = await App.db.todos(n);
        const ex = todos.filter((x) => x.exemplo);
        if (!ex.length) continue;
        await App.db.transacao([n], (l) => ex.forEach((x) => {
          if (n === 'insumos' && usados.has(x.id)) {
            l(n).put(Object.assign({}, x, { exemplo: false }));
            mantidos.push(x.nome);
          } else {
            l(n).delete(x.id);
          }
        }));
      }
      const atual = await App.db.config('pessoaAtual');
      if (atual && String(atual).startsWith('ex-')) await App.db.apagar('config', 'pessoaAtual');
      return mantidos;
    },

    // Apaga TUDO do celular e coloca os exemplos de novo
    // (a senha da Área do dono continua a mesma)
    async recomecar() {
      const senha = await App.db.config('senhaDono');
      for (const n of App.db.LOJAS.concat('config')) await App.db.limpar(n);
      await semear();
      if (senha) await App.db.definir('senhaDono', senha);
    },
  };
})();
