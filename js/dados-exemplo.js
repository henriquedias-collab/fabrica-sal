// Dados de demonstração. Tudo tem exemplo: true e id começando com "ex-",
// para poder apagar de uma vez (Área do dono > Dados de exemplo).
// ATENÇÃO: números só de exemplo, ainda NÃO são do técnico. Não são recomendação nutricional.
// Base: pasta "07 Pesquisa" (custos.xlsx, nucleos.md, consumo.md), premissas do pai e cotações de 06/10/2026.
window.App = window.App || {};

(function () {
  const pessoas = [
    { id: 'ex-ze', nome: 'Zé', funcao: 'operador', cor: '#1d6b3a' },
    { id: 'ex-antonio', nome: 'Antônio', funcao: 'operador', cor: '#1f4fa0' },
  ];

  // estoqueKg = estoque estimado agora (sempre em kg). precoKg = R$ por kg. kgPorSaco = saco atual (o da compra
  // mais recente). maxPct = máximo na mistura (%).
  // Estoques escolhidos para a demonstração: sal e núcleo mineral sobrando, núcleo proteico perto de acabar,
  // núcleo reprodução abaixo do mínimo (e sem preço: não achei preço público), farelo em falta.
  const insumos = [
    // Sal comum: premissa do pai, R$ 15 o saco de 25 kg
    { id: 'ex-sal', nome: 'Sal comum', cor: '#e9e7e1', corTexto: '#3d3a33', unidade: 'saco', kgPorSaco: 25, estoqueKg: 3000, estoqueMinimoKg: 1000, precoKg: 0.6 },
    // Núcleo mineral: Fosbovi 30 (25 kg) R$ 328,65 — AB Araújo, 06/10/2026 (custos.xlsx)
    { id: 'ex-nucleo', nome: 'Núcleo mineral', cor: '#e2d6ee', corTexto: '#4b2f73', unidade: 'saco', kgPorSaco: 25, estoqueKg: 750, estoqueMinimoKg: 200, precoKg: 13.146 },
    // Núcleo reprodução (mais fósforo): preço público não encontrado -> sem preço (mostra "sem preço" no custo)
    { id: 'ex-nucleo-repro', nome: 'Núcleo mineral reprodução', cor: '#d9eeee', corTexto: '#0f4f4f', unidade: 'saco', kgPorSaco: 25, estoqueKg: 50, estoqueMinimoKg: 250, precoKg: null },
    // Núcleo proteico: Premix Campo Seca R$ 7,58/kg -> R$ 189,50 por 25 kg (custos.xlsx)
    { id: 'ex-nucleo-prot', nome: 'Núcleo proteico', cor: '#f3dbe7', corTexto: '#6e1a45', unidade: 'saco', kgPorSaco: 25, estoqueKg: 400, estoqueMinimoKg: 250, precoKg: 7.58 },
    // Farelo de soja: R$ 2.130/t (média RS, Notícias Agrícolas, 06/10/2026) -> R$ 106,50 por 50 kg
    { id: 'ex-farelo', nome: 'Farelo de soja', cor: '#ecd3a2', corTexto: '#6b4a12', unidade: 'saco', kgPorSaco: 50, estoqueKg: 0, estoqueMinimoKg: 500, precoKg: 2.13 },
    // Milho moído: CEPEA R$ 67,23 a saca de 60 kg (06/10/2026)
    { id: 'ex-milho', nome: 'Milho moído', cor: '#f8e2c9', corTexto: '#6b3500', unidade: 'saco', kgPorSaco: 60, estoqueKg: 1200, estoqueMinimoKg: 300, precoKg: 1.1205 },
    // Ureia: R$ 249,90 o saco de 25 kg (anúncio de busca, não conferido). Máximo de exemplo: 3% (NÃO é do técnico)
    { id: 'ex-ureia', nome: 'Ureia', cor: '#dfe7f2', corTexto: '#1f3f6e', unidade: 'saco', kgPorSaco: 25, estoqueKg: 250, estoqueMinimoKg: 100, precoKg: 9.996, maxPct: 3 },
  ];

  // itens: kg de cada insumo na batida BASE, na ordem em que entram no misturador.
  // pronto*: sal comprado pronto para comparar o custo.
  const formulas = [
    {
      id: 'ex-f-mineral', nome: 'Sal mineral águas', numero: 1, cor: '#1f4fa0', corClara: '#dbe5f5',
      tipo: 'mineral', epoca: 'aguas', tamanhos: [350, 500], tamanhoPadrao: 500,
      itens: [{ insumoId: 'ex-sal', kg: 350 }, { insumoId: 'ex-nucleo', kg: 150 }], // exemplo do pai
      prontoPrecoSaco: 162, prontoKgSaco: 30, // Fosbovi 15 pronto (Agrosolo, 06/10/2026)
    },
    {
      id: 'ex-f-repro', nome: 'Sal mineral reprodução', numero: 2, cor: '#0f6b6b', corClara: '#d9eeee',
      tipo: 'mineral', epoca: 'aguas', tamanhos: [250, 500], tamanhoPadrao: 500,
      itens: [{ insumoId: 'ex-sal', kg: 250 }, { insumoId: 'ex-nucleo-repro', kg: 250 }], // 1:1 como nas bulas de núcleo
      prontoPrecoSaco: 313.45, prontoKgSaco: 30, // Fosbovi Reprodução pronto (AB Araújo, 06/10/2026)
    },
    {
      // Receita "Campo 60" da Premix (a que tem os 5 insumos): 40% núcleo + 37% farelo + 3% milho + 18% sal + 2% ureia
      id: 'ex-f-prot-seca', nome: 'Proteinado seca', numero: 3, cor: '#a65300', corClara: '#f8e2c9',
      tipo: 'proteinado', epoca: 'seca', tamanhos: [250, 500], tamanhoPadrao: 500,
      itens: [
        { insumoId: 'ex-nucleo-prot', kg: 200 },
        { insumoId: 'ex-farelo', kg: 185 },
        { insumoId: 'ex-milho', kg: 15 },
        { insumoId: 'ex-sal', kg: 90 },
        { insumoId: 'ex-ureia', kg: 10 },
      ],
      prontoPrecoSaco: 111, prontoKgSaco: 25, // proteinado pronto: premissa do pai
    },
    {
      // Receita "Campo 40" da Premix: 40% núcleo + 35% milho + 25% sal (sem farelo e sem ureia avulsa)
      id: 'ex-f-prot-recria', nome: 'Proteinado recria', numero: 4, cor: '#8c2257', corClara: '#f3dbe7',
      tipo: 'proteinado', epoca: 'seca', tamanhos: [250, 500], tamanhoPadrao: 250,
      itens: [
        { insumoId: 'ex-nucleo-prot', kg: 200 },
        { insumoId: 'ex-milho', kg: 175 },
        { insumoId: 'ex-sal', kg: 125 },
      ],
      prontoPrecoSaco: 181.26, prontoKgSaco: 30, // Fosbovi Proteico 35 (AB Araújo, 06/10/2026)
    },
  ];

  // Lotes com o sal das águas e da seca e a meta de consumo (g/cabeça/dia) — metas de EXEMPLO, não do técnico.
  // Na seca (época marcada), o histórico deixa: Vacas prenhes ACIMA da meta e Garrotes ABAIXO; os outros dentro.
  const pastos = [
    { id: 'ex-pasto-1', numero: 1, nome: 'Receptoras', cor: '#1d6b3a', corClara: '#d6e8dc', cabecas: 160,
      formulaAguasId: 'ex-f-repro', formulaSecaId: 'ex-f-prot-seca', metaAguasG: 100, metaSecaG: 450 },
    { id: 'ex-pasto-2', numero: 2, nome: 'Novilhas', cor: '#1f4fa0', corClara: '#dbe5f5', cabecas: 100,
      formulaAguasId: 'ex-f-repro', formulaSecaId: 'ex-f-prot-seca', metaAguasG: 80, metaSecaG: 350 },
    { id: 'ex-pasto-3', numero: 3, nome: 'Vacas prenhes', cor: '#a65300', corClara: '#f8e2c9', cabecas: 200,
      formulaAguasId: 'ex-f-mineral', formulaSecaId: 'ex-f-prot-seca', metaAguasG: 100, metaSecaG: 500 },
    { id: 'ex-pasto-4', numero: 4, nome: 'Garrotes', cor: '#5b3a8a', corClara: '#e6dcf2', cabecas: 180,
      formulaAguasId: 'ex-f-mineral', formulaSecaId: 'ex-f-prot-recria', metaAguasG: 70, metaSecaG: 300 },
    { id: 'ex-pasto-5', numero: 5, nome: 'Bezerros', cor: '#0f6b6b', corClara: '#d9eeee', cabecas: 240,
      formulaAguasId: 'ex-f-mineral', formulaSecaId: 'ex-f-prot-recria', metaAguasG: 40, metaSecaG: 150 },
  ];

  const D = () => App.calc.DIA;
  // Data "d dias atrás, às h:mm"
  function quandoDias(d, h, m) {
    const x = new Date(Date.now() - d * D());
    x.setHours(h, m || 0, 0, 0);
    return x.getTime();
  }

  // Histórico de 44 dias (tudo na seca): cada lote recebe a mesma quantidade toda semana, sempre no mesmo dia,
  // para a janela de 7 dias do painel ficar estável. Mais algumas batidas para o depósito.
  function historico() {
    const porId = {};
    insumos.forEach((i) => { porId[i.id] = i; });
    const fPorId = {};
    formulas.forEach((f) => { fPorId[f.id] = f; });
    const pPorId = {};
    pastos.forEach((p) => { pPorId[p.id] = p; });
    // [lote (ou null = depósito), fórmula, tamanho (kg), dias atrás em que se repete (resto da divisão por 7) ou lista fixa, hora]
    const plano = [
      ['ex-pasto-1', 'ex-f-prot-seca', 500, { resto: 2 }, 7],
      ['ex-pasto-2', 'ex-f-prot-seca', 250, { resto: 5 }, 9],
      ['ex-pasto-3', 'ex-f-prot-seca', 500, { resto: 1 }, 7],
      ['ex-pasto-3', 'ex-f-prot-seca', 500, { resto: 4 }, 14],
      ['ex-pasto-4', 'ex-f-prot-recria', 250, { resto: 3 }, 8],
      ['ex-pasto-5', 'ex-f-prot-recria', 250, { resto: 6 }, 10],
      [null, 'ex-f-mineral', 350, { dias: [10, 24, 38] }, 15],
      [null, 'ex-f-mineral', 500, { dias: [31] }, 15],
      [null, 'ex-f-repro', 250, { dias: [20] }, 15],
    ];
    const lista = [];
    plano.forEach(([pastoId, formulaId, tamanho, regra, hora], k) => {
      const dias = regra.dias || Array.from({ length: 44 }, (_, i) => i + 1).filter((d) => d % 7 === regra.resto);
      dias.forEach((d) => {
        const inicio = quandoDias(d, hora, 5 + (d % 4) * 10);
        const p = pastoId ? pPorId[pastoId] : null;
        const m = App.calc.montarMistura({
          formula: App.calc.escalarFormula(fPorId[formulaId], tamanho), insumosPorId: porId,
          pessoa: pessoas[(d + k) % 2], exemplo: true,
          destino: p ? { tipo: 'pasto', id: p.id, numero: p.numero, nome: p.nome } : { tipo: 'deposito', nome: 'Depósito' },
          inicio: new Date(inicio).toISOString(), fim: new Date(inicio + 35 * 60 * 1000).toISOString(),
        });
        m.tamanhoKg = tamanho;
        // Ontem faltou farelo: a mistura das vacas foi feita mesmo com o aviso de falta
        if (d === 1 && formulaId === 'ex-f-prot-seca') {
          m.avisoFalta = [{ insumoId: 'ex-farelo', precisaKg: 185, temKg: 0 }];
        }
        lista.push(m);
      });
    });
    lista.sort((a, b) => a.fim.localeCompare(b.fim));
    lista.forEach((m, k) => { m.id = 'ex-mistura-' + k; });
    return lista;
  }

  // Chegadas de insumo (uma com saco de peso diferente do cadastro, para o aviso aparecer em Registros)
  function entradasExemplo() {
    const porId = {};
    insumos.forEach((i) => { porId[i.id] = i; });
    // anterior = saco atual do insumo antes desta chegada (se mudou, a chegada aparece como "saco atual mudou")
    const chegou = (k, insumoId, quantidade, pesoCada, d, quem, anterior) => {
      const ins = porId[insumoId];
      const kg = quantidade * pesoCada;
      const nomeUn = quantidade === 1 ? 'saco' : 'sacos';
      return {
        id: 'ex-entrada-' + k, insumoId, insumoNome: ins.nome, quantidade, unidade: 'saco',
        kgPorUnidade: pesoCada, kgPorUnidadeCadastro: anterior || pesoCada, pesoDiferente: Math.abs(pesoCada - (anterior || pesoCada)) > 0.05, kg,
        texto: `${quantidade} ${nomeUn} × ${App.calc.numero(pesoCada)} kg = ${App.calc.numero(kg)} kg`,
        pessoaId: quem.id, pessoaNome: quem.nome, quando: new Date(quandoDias(d, 11, 20)).toISOString(), exemplo: true,
      };
    };
    return [
      chegou(1, 'ex-nucleo', 20, 25, 40, pessoas[0]),
      chegou(2, 'ex-ureia', 10, 25, 35, pessoas[1]),
      chegou(3, 'ex-sal', 80, 25, 30, pessoas[0]),
      chegou(4, 'ex-farelo', 40, 50, 25, pessoas[1]),
      chegou(5, 'ex-nucleo-prot', 60, 25, 20, pessoas[0]),
      chegou(6, 'ex-milho', 10, 50, 15, pessoas[1], 60), // saca de 50 kg: o saco atual passou de 60 para 50
      chegou(7, 'ex-milho', 30, 60, 8, pessoas[0], 50), // saca de 60 kg: voltou a ser o saco atual (compra mais recente)
    ];
  }

  // Contagem de estoque de 4 dias atrás (previsto x real; entra nas perdas do resumo da semana): núcleo proteico sumiu 1 saco; sal comum bateu; milho sem contagem
  function contagensExemplo() {
    const quando = new Date(quandoDias(4, 17)).toISOString();
    return [
      { id: 'ex-contagem-1', insumoId: 'ex-nucleo-prot', insumoNome: 'Núcleo proteico', antesKg: 425, depoisKg: 400, quando, tipo: 'contagem', exemplo: true },
      { id: 'ex-contagem-2', insumoId: 'ex-sal', insumoNome: 'Sal comum', antesKg: 3000, depoisKg: 3000, quando, tipo: 'contagem', exemplo: true },
    ];
  }

  // "Foto" de exemplo (desenho simples de um saco rasgado), só para a demonstração mostrar a foto do problema
  const FOTO_SACO_RASGADO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e8dcc8"/>' +
    '<path d="M34 22h52l-8 14c18 8 26 24 26 40 0 22-16 34-44 34S16 98 16 76c0-16 8-32 26-40z" fill="#f5efe4" stroke="#7a3d00" stroke-width="4"/>' +
    '<path d="M34 74l10 8 8-10 10 10 8-8 10 8" fill="none" stroke="#b3261e" stroke-width="5"/>' +
    '<circle cx="60" cy="102" r="3" fill="#fff"/><circle cx="70" cy="106" r="2.5" fill="#fff"/><circle cx="50" cy="105" r="2" fill="#fff"/></svg>');

  // Problemas: saco de ureia rasgado (aberto), faltou farelo (aberto), máquina parada (resolvido)
  function problemasExemplo() {
    return [
      {
        id: 'ex-problema-1', tipo: 'saco-rasgado', quando: new Date(quandoDias(3, 9, 40)).toISOString(),
        insumoId: 'ex-ureia', insumoNome: 'Ureia', audio: null, audioSegundos: 0, foto: FOTO_SACO_RASGADO,
        pessoaId: 'ex-ze', pessoaNome: 'Zé', exemplo: true,
        perdaKg: 25, // 1 saco de ureia perdido (informado pelo dono no resumo)
      },
      {
        id: 'ex-problema-4', tipo: 'molhado', quando: new Date(quandoDias(6, 15, 10)).toISOString(),
        insumoId: 'ex-sal', insumoNome: 'Sal comum', audio: null, audioSegundos: 0, foto: null,
        pessoaId: 'ex-antonio', pessoaNome: 'Antônio', exemplo: true,
        resolvidoEm: new Date(quandoDias(5, 10)).toISOString(),
        perdaKg: 50, // 2 sacos de sal molhados
      },
      {
        id: 'ex-problema-2', tipo: 'faltou-insumo', quando: new Date(quandoDias(1, 6, 50)).toISOString(),
        formulaId: 'ex-f-prot-seca', formulaNome: 'Proteinado seca',
        faltas: [{ insumoId: 'ex-farelo', nome: 'Farelo de soja', precisaKg: 185, temKg: 0 }],
        pessoaId: 'ex-antonio', pessoaNome: 'Antônio', exemplo: true,
      },
      {
        id: 'ex-problema-3', tipo: 'maquina-parada', quando: new Date(quandoDias(12, 8)).toISOString(),
        insumoId: null, insumoNome: null, audio: null, audioSegundos: 0, foto: null,
        pessoaId: 'ex-ze', pessoaNome: 'Zé', exemplo: true,
        resolvidoEm: new Date(quandoDias(11, 16)).toISOString(),
      },
    ];
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
      entradas: entradasExemplo(),
      contagens: contagensExemplo(),
      problemas: problemasExemplo(),
    };
    const nomes = Object.keys(dados).concat('config');
    await App.db.transacao(nomes, (l) => {
      Object.keys(dados).forEach((n) => dados[n].forEach((x) => l(n).put(x)));
      l('config').put({ chave: 'exemploCarregado', valor: new Date().toISOString() });
      // Época de exemplo: seca marcada; a seca começa em maio e as águas em outubro (o painel avisa no mês da troca)
      l('config').put({ chave: 'epocaAtual', valor: 'seca' });
      l('config').put({ chave: 'mesesEpoca', valor: { inicioSeca: 5, inicioAguas: 10 } });
      l('config').put({ chave: 'nomeFazenda', valor: 'Fazenda Exemplo' });
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
