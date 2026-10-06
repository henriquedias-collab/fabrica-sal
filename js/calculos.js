// Contas do app: sacos, dias de estoque, montar e salvar a mistura.
window.App = window.App || {};

(function () {
  const DIA = 24 * 60 * 60 * 1000;
  const DIAS_CONSUMO = 14; // média de consumo dos últimos 14 dias
  const ALERTA_DIAS = 7; // abaixo disso, avisa no Início (laranja)
  const PERIGO_DIAS = 3; // abaixo disso, vermelho

  function numero(n) {
    return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  // Unidades em que o insumo chega. "kg" = a granel (conta direto em quilos).
  const UNIDADES = {
    saco: { um: 'saco', varios: 'sacos' },
    balde: { um: 'balde', varios: 'baldes' },
    bag: { um: 'bag', varios: 'bags' },
    kg: { um: 'kg', varios: 'kg', granel: true },
  };

  function unidade(ins) {
    const u = UNIDADES[(ins && ins.unidade) || 'saco'] || UNIDADES.saco;
    const kgPor = u.granel ? 0 : (ins && ins.kgPorSaco) || 0;
    return Object.assign({ kgPor }, u);
  }

  // "saco" ou "sacos", conforme a quantidade
  function nomeUnidade(n, ins) {
    const u = unidade(ins);
    return n === 1 ? u.um : u.varios;
  }

  // 100 kg em sacos de 30 kg -> { n: 3, resto: 10 }. A granel -> { n: 0, resto: 100 }
  function qtd(kg, ins) {
    const { kgPor } = unidade(ins);
    if (!kgPor) return { n: 0, resto: Math.round(kg * 10) / 10 };
    const n = Math.floor(kg / kgPor + 1e-9);
    const resto = Math.round((kg - n * kgPor) * 10) / 10;
    return { n, resto };
  }

  // "3 sacos + 10 kg"
  function qtdTexto(kg, ins) {
    const q = qtd(kg, ins);
    const partes = [];
    if (q.n) partes.push(q.n + ' ' + nomeUnidade(q.n, ins));
    if (q.resto || !q.n) partes.push(numero(q.resto) + ' kg');
    return partes.join(' + ');
  }

  // Para a voz: "3 sacos e mais 10 quilos"
  function qtdFala(kg, ins) {
    const q = qtd(kg, ins);
    const partes = [];
    if (q.n) partes.push(q.n + ' ' + nomeUnidade(q.n, ins));
    if (q.resto || !q.n) partes.push(numero(q.resto) + ' quilos');
    return partes.join(' e mais ');
  }

  // kg por dia de cada insumo, pela média das misturas dos últimos 14 dias
  function consumoDiario(misturas, agora) {
    const inicio = new Date((agora || Date.now()) - DIAS_CONSUMO * DIA);
    inicio.setHours(0, 0, 0, 0); // conta os 14 dias inteiros, desde a meia-noite
    const desde = inicio.getTime();
    const total = {};
    misturas.forEach((m) => {
      if (new Date(m.fim).getTime() < desde) return;
      m.itens.forEach((it) => { total[it.insumoId] = (total[it.insumoId] || 0) + it.kg; });
    });
    Object.keys(total).forEach((id) => { total[id] = total[id] / DIAS_CONSUMO; });
    return total;
  }

  // Situação do estoque de cada insumo: dias que dá e nível (null = tudo certo), do pior para o melhor
  function situacaoEstoque(insumos, misturas, agora) {
    const consumo = consumoDiario(misturas, agora);
    const peso = { vermelho: 0, laranja: 1 };
    return insumos
      .map((i) => {
        const porDia = consumo[i.id] || 0;
        const dias = porDia > 0 ? Math.floor(i.estoqueKg / porDia) : null;
        let nivel = null;
        if (i.estoqueKg <= 0) nivel = 'vermelho';
        else if (dias !== null && dias < PERIGO_DIAS) nivel = 'vermelho';
        else if (dias !== null && dias < ALERTA_DIAS) nivel = 'laranja';
        else if (i.estoqueKg < (i.estoqueMinimoKg || 0)) nivel = 'laranja';
        return { insumo: i, dias, porDia, nivel };
      })
      .sort((a, b) => {
        const na = a.nivel ? peso[a.nivel] : 2;
        const nb = b.nivel ? peso[b.nivel] : 2;
        if (na !== nb) return na - nb;
        return (a.dias ?? 9999) - (b.dias ?? 9999);
      });
  }

  // Insumos que pedem atenção no Início, do pior para o menos grave
  async function alertasEstoque() {
    const [insumos, misturas] = await Promise.all([App.db.todos('insumos'), App.db.todos('misturas')]);
    return situacaoEstoque(insumos, misturas).filter((a) => a.nivel);
  }

  // ---------- painel dos donos ----------

  const DIAS_PAINEL = 7; // o painel olha os últimos 7 dias
  const DIAS_COMPRA = 30; // a lista de compras cobre 30 dias de produção

  // Todas as contas do painel. dados = { misturas, insumos, pastos, problemas, contagens }
  function painel(dados, agora) {
    agora = agora || Date.now();
    const inicio = agora - DIAS_PAINEL * DIA;
    const inicioAnterior = inicio - DIAS_PAINEL * DIA;
    const t = (iso) => new Date(iso).getTime();
    const doPeriodo = dados.misturas.filter((m) => t(m.fim) >= inicio && t(m.fim) <= agora);
    const anteriores = dados.misturas.filter((m) => t(m.fim) >= inicioAnterior && t(m.fim) < inicio);
    const somaKg = (lista) => lista.reduce((s, m) => s + (m.totalKg || 0), 0);

    // Produção: misturas e kg, total e por fórmula
    const porFormula = {};
    doPeriodo.forEach((m) => {
      const f = porFormula[m.formulaId] || (porFormula[m.formulaId] = { nome: m.formulaNome, n: 0, kg: 0 });
      f.n += 1;
      f.kg += m.totalKg || 0;
    });
    const producao = {
      n: doPeriodo.length,
      kg: somaKg(doPeriodo),
      porFormula: Object.values(porFormula).sort((a, b) => b.kg - a.kg),
      anterior: { n: anteriores.length, kg: somaKg(anteriores) },
    };

    // Previsto x real: previsto = o que as fórmulas pediram; diferença = o que as contagens acharam a menos (+) ou a mais (−)
    const previsto = {};
    doPeriodo.forEach((m) => m.itens.forEach((it) => { previsto[it.insumoId] = (previsto[it.insumoId] || 0) + it.kg; }));
    const diferenca = {};
    const contado = {};
    dados.contagens
      .filter((c) => c.tipo !== 'inicial' && t(c.quando) >= inicio && t(c.quando) <= agora)
      .forEach((c) => {
        contado[c.insumoId] = true;
        diferenca[c.insumoId] = (diferenca[c.insumoId] || 0) + (c.antesKg - c.depoisKg);
      });
    const previstoReal = dados.insumos
      .filter((i) => previsto[i.id] || contado[i.id])
      .map((i) => {
        const prev = previsto[i.id] || 0;
        const dif = Math.round((diferenca[i.id] || 0) * 10) / 10;
        let nivel;
        if (!contado[i.id]) nivel = 'sem';
        else if (Math.abs(dif) <= Math.max(prev * 0.01, 0.5)) nivel = 'verde'; // até 1%: bateu
        else if (prev > 0 && Math.abs(dif) <= prev * 0.1) nivel = 'laranja';
        else nivel = 'vermelho';
        return { insumo: i, previstoKg: prev, difKg: dif, realKg: prev + dif, contado: !!contado[i.id], nivel };
      })
      .sort((a, b) => b.previstoKg - a.previstoKg);

    // Consumo por cabeça por dia: kg mandados ao pasto ÷ cabeças ÷ dias.
    // Se o app começou a ser usado há menos de 7 dias, divide pelos dias de uso.
    const primeira = dados.misturas.reduce((min, m) => Math.min(min, t(m.fim)), Infinity);
    const dias = primeira === Infinity ? DIAS_PAINEL : Math.min(DIAS_PAINEL, Math.max(1, Math.ceil((agora - primeira) / DIA)));
    const kgPasto = {};
    let kgDeposito = 0;
    doPeriodo.forEach((m) => {
      if (m.destino && m.destino.tipo === 'pasto') kgPasto[m.destino.id] = (kgPasto[m.destino.id] || 0) + (m.totalKg || 0);
      else kgDeposito += m.totalKg || 0;
    });
    const consumoPastos = dados.pastos
      .slice()
      .sort((a, b) => (a.numero || 0) - (b.numero || 0))
      .map((p) => {
        const kg = kgPasto[p.id] || 0;
        const gramas = p.cabecas > 0 && kg > 0 ? Math.round((kg * 1000) / p.cabecas / dias) : null;
        return { pasto: p, kg, gramas };
      });

    // Lista de compras: o que falta para 30 dias de produção + o estoque mínimo, em sacos inteiros
    const estoque = situacaoEstoque(dados.insumos, dados.misturas, agora);
    const compras = estoque
      .map(({ insumo: i, porDia }) => {
        const faltaKg = porDia * DIAS_COMPRA + (i.estoqueMinimoKg || 0) - i.estoqueKg;
        if (faltaKg <= 0.05) return null;
        const { kgPor } = unidade(i);
        const unidades = kgPor ? Math.ceil(faltaKg / kgPor - 1e-9) : Math.ceil(faltaKg);
        const kg = kgPor ? unidades * kgPor : unidades;
        const custo = i.precoPorUnidade > 0 ? unidades * i.precoPorUnidade : null;
        return { insumo: i, unidades, kg, custo };
      })
      .filter(Boolean)
      .sort((a, b) => a.insumo.nome.localeCompare(b.insumo.nome, 'pt-BR'));

    const problemasAbertos = dados.problemas
      .filter((p) => !p.resolvidoEm)
      .sort((a, b) => b.quando.localeCompare(a.quando));

    return { inicio, agora, dias, producao, previstoReal, estoque, consumoPastos, kgDeposito, compras, problemasAbertos };
  }

  // O que falta no estoque para fazer uma batida desta fórmula
  function faltas(formula, insumosPorId) {
    return formula.itens
      .map((it) => {
        const ins = insumosPorId[it.insumoId];
        return { insumo: ins, precisaKg: it.kg, temKg: Math.max(0, ins ? ins.estoqueKg : 0) };
      })
      .filter((f) => f.insumo && f.temKg < f.precisaKg);
  }

  function montarMistura({ formula, insumosPorId, destino, pessoa, inicio, fim, exemplo }) {
    const itens = formula.itens.map((it) => ({
      insumoId: it.insumoId,
      nome: insumosPorId[it.insumoId] ? insumosPorId[it.insumoId].nome : '?',
      kg: it.kg,
    }));
    return {
      id: App.db.novoId('mistura'),
      formulaId: formula.id,
      formulaNome: formula.nome,
      itens,
      totalKg: itens.reduce((s, it) => s + it.kg, 0),
      destino,
      pessoaId: pessoa ? pessoa.id : null,
      pessoaNome: pessoa ? pessoa.nome : '',
      inicio,
      fim,
      exemplo: !!exemplo,
    };
  }

  // Salva a mistura e baixa do estoque estimado o que a fórmula pediu (tudo junto)
  async function salvarMistura(mistura) {
    const insumos = await App.db.todos('insumos');
    const porId = {};
    insumos.forEach((i) => { porId[i.id] = i; });
    const alterados = [];
    mistura.itens.forEach((it) => {
      const ins = porId[it.insumoId];
      if (!ins) return;
      ins.estoqueKg = Math.max(0, Math.round((ins.estoqueKg - it.kg) * 10) / 10);
      alterados.push(ins);
    });
    await App.db.transacao(['misturas', 'insumos'], (l) => {
      l('misturas').put(mistura);
      alterados.forEach((i) => l('insumos').put(i));
    });
    return mistura;
  }

  // Chegou insumo: soma ao estoque e registra a entrada (tudo junto).
  // kgPorUnidade = peso de cada saco que chegou (o operador pode mudar); o cadastro do insumo não muda.
  async function salvarEntrada({ insumo, quantidade, kgPorUnidade, pessoa }) {
    const ins = await App.db.pegar('insumos', insumo.id);
    const { kgPor, granel } = unidade(ins);
    const pesoCada = granel ? null : (kgPorUnidade > 0 ? kgPorUnidade : kgPor);
    const kg = granel ? quantidade : Math.round(quantidade * pesoCada * 10) / 10;
    ins.estoqueKg = Math.round((ins.estoqueKg + kg) * 10) / 10;
    const pesoDiferente = !granel && Math.abs(pesoCada - kgPor) > 0.05;
    const entrada = {
      id: App.db.novoId('entrada'),
      insumoId: ins.id,
      insumoNome: ins.nome,
      quantidade,
      unidade: ins.unidade || 'saco',
      kgPorUnidade: pesoCada, // peso de cada saco nesta chegada
      kgPorUnidadeCadastro: granel ? null : kgPor, // peso que estava no cadastro
      pesoDiferente,
      kg,
      texto: granel ? numero(kg) + ' kg' : `${quantidade} ${nomeUnidade(quantidade, ins)} × ${numero(pesoCada)} kg = ${numero(kg)} kg`,
      pessoaId: pessoa ? pessoa.id : null,
      pessoaNome: pessoa ? pessoa.nome : '',
      quando: new Date().toISOString(),
      exemplo: false,
    };
    await App.db.transacao(['entradas', 'insumos'], (l) => {
      l('entradas').put(entrada);
      l('insumos').put(ins);
    });
    return { entrada, insumo: ins };
  }

  function iniciais(nome) {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  // "Hoje · 9h40", "Ontem · 14h05" ou "03/10 · 9h40"
  function quando(iso) {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(Date.now() - DIA);
    const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
    const hora = d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0');
    let dia;
    if (mesmoDia(d, hoje)) dia = 'Hoje';
    else if (mesmoDia(d, ontem)) dia = 'Ontem';
    else dia = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    return dia + ' · ' + hora;
  }

  App.calc = {
    DIA, DIAS_PAINEL, DIAS_COMPRA, UNIDADES, numero, unidade, nomeUnidade, qtd, qtdTexto, qtdFala, consumoDiario,
    situacaoEstoque, alertasEstoque, painel, faltas,
    montarMistura, salvarMistura, salvarEntrada, iniciais, quando,
  };
})();
