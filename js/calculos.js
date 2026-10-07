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
    const q = qtd(Math.max(0, kg), ins); // estoque calculado pode ficar abaixo de zero: mostra 0
    const partes = [];
    if (q.n) partes.push(q.n + ' ' + nomeUnidade(q.n, ins));
    if (q.resto || !q.n) partes.push(numero(q.resto) + ' kg');
    return partes.join(' + ');
  }

  // Para a voz: "3 sacos e mais 10 quilos"
  function qtdFala(kg, ins) {
    const q = qtd(Math.max(0, kg), ins);
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

  // Pesos comuns de cada embalagem (botões na chegada, nos preços e na contagem)
  const PESOS_COMUNS = { saco: [25, 30, 40, 50], balde: [10, 15, 20, 25], bag: [500, 750, 1000, 1200] };

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

    // Custo (preços de hoje dos insumos): das misturas da semana e de cada fórmula, com comparação ao sal pronto
    const insPorId = {};
    dados.insumos.forEach((i) => { insPorId[i.id] = i; });
    const custoMistura = (m) => custoItens(m.itens, insPorId);
    const semanaCustos = doPeriodo.map(custoMistura);
    const semPrecoSemana = [...new Set([].concat(...semanaCustos.map((c) => c.semPreco)))];
    const kg30 = kgPorFormula(dados.misturas, 30, agora);
    const custo = {
      semana: semPrecoSemana.length ? null : semanaCustos.reduce((s, c) => s + c.total, 0),
      semPrecoSemana,
      formulas: (dados.formulas || [])
        .filter((f) => kg30[f.id] || doPeriodo.some((m) => m.formulaId === f.id))
        .sort((a, b) => (a.numero || 0) - (b.numero || 0))
        .map((f) => {
          const c = custoItens(f.itens, insPorId);
          const cp = comparaPronto(f, insPorId, dados.misturas, agora);
          const tamanhoKg = tamanhoPadrao(f);
          return {
            formula: f, porKg: c.porKg, semPreco: c.semPreco, tamanhoKg,
            batida: c.porKg !== null ? c.porKg * tamanhoKg : null,
            prontoKg: cp.prontoKg, kg30: cp.kg30, economiaMes: cp.economiaMes,
          };
        }),
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
    const custoPasto = {}; // R$ mandados ao pasto (null se algum insumo está sem preço)
    let kgDeposito = 0;
    doPeriodo.forEach((m) => {
      if (m.destino && m.destino.tipo === 'pasto') {
        const id = m.destino.id;
        kgPasto[id] = (kgPasto[id] || 0) + (m.totalKg || 0);
        const c = custoMistura(m);
        custoPasto[id] = custoPasto[id] === null || c.total === null ? null : (custoPasto[id] || 0) + c.total;
      } else if (m.destino && m.destino.tipo === 'deposito') kgDeposito += m.totalKg || 0;
    });
    // Meta do técnico por lote e época (g/cabeça/dia): dentro de ±10% = verde; fora = amarelo (acima ou abaixo)
    const consumoPastos = dados.pastos
      .slice()
      .sort((a, b) => (a.numero || 0) - (b.numero || 0))
      .map((p) => {
        const kg = kgPasto[p.id] || 0;
        const gramas = p.cabecas > 0 && kg > 0 ? Math.round((kg * 1000) / p.cabecas / dias) : null;
        const custoCabDia = p.cabecas > 0 && kg > 0 && custoPasto[p.id] !== null && custoPasto[p.id] !== undefined
          ? custoPasto[p.id] / p.cabecas / dias : null;
        const meta = dados.epoca === 'seca' ? p.metaSecaG : dados.epoca === 'aguas' ? p.metaAguasG : null;
        let nivelMeta = null;
        if (meta > 0 && gramas !== null) {
          const dif = gramas / meta - 1;
          nivelMeta = Math.abs(dif) <= 0.1 ? 'dentro' : dif > 0 ? 'acima' : 'abaixo';
        }
        return { pasto: p, kg, gramas, custoCabDia, semPreco: kg > 0 && custoPasto[p.id] === null, meta: meta > 0 ? meta : null, nivelMeta };
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
        const pk = precoKg(i);
        const custo = pk !== null ? kg * pk : null; // custo pelo R$/kg
        return { insumo: i, unidades, kg, custo };
      })
      .filter(Boolean)
      .sort((a, b) => a.insumo.nome.localeCompare(b.insumo.nome, 'pt-BR'));

    const problemasAbertos = dados.problemas
      .filter((p) => !p.resolvidoEm)
      .sort((a, b) => b.quando.localeCompare(a.quando));

    return { inicio, agora, dias, producao, custo, previstoReal, estoque, consumoPastos, kgDeposito, compras, problemasAbertos };
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

  // Mistura completa de uma vez (usada nos dados de exemplo): colocado = o que a fórmula pede
  function montarMistura({ formula, insumosPorId, destino, pessoa, inicio, fim, exemplo }) {
    const itens = formula.itens.map((it) => ({
      insumoId: it.insumoId,
      nome: insumosPorId[it.insumoId] ? insumosPorId[it.insumoId].nome : '?',
      kg: it.kg,
      kgFormula: it.kg,
    }));
    return {
      id: App.db.novoId('mistura'),
      formulaId: formula.id,
      formulaNome: formula.nome,
      itens,
      totalKg: itens.reduce((s, it) => s + it.kg, 0),
      status: 'completa',
      destino,
      pessoaId: pessoa ? pessoa.id : null,
      pessoaNome: pessoa ? pessoa.nome : '',
      inicio,
      fim,
      exemplo: !!exemplo,
    };
  }

  // ---------- custo (etapa 4.3) ----------
  // Preço do kg de um insumo: preço do saco ÷ kg do saco (a granel, o preço já é por kg). Sem preço = null.
  function precoKg(ins) {
    if (!ins) return null;
    if (ins.precoKg !== undefined) return ins.precoKg > 0 ? ins.precoKg : null; // guardado em R$/kg (desde out/2026)
    // Cadastro antigo ainda não convertido: preço do saco ÷ kg do saco
    if (!(ins.precoPorUnidade > 0)) return null;
    const { kgPor } = unidade(ins);
    return kgPor ? ins.precoPorUnidade / kgPor : ins.precoPorUnidade;
  }

  // Converte os preços antigos (por saco) para R$/kg, uma vez, sem apagar o valor antigo.
  // Roda ao abrir o app e depois de importar uma cópia antiga.
  async function converterPrecosParaKg() {
    const lista = await App.db.todos('insumos');
    const mudar = lista.filter((i) => i.precoKg === undefined).map((i) => {
      const p = i.precoPorUnidade > 0 ? precoKg(i) : null;
      return Object.assign({}, i, { precoKg: p === null ? null : Math.round(p * 10000) / 10000 });
    });
    if (mudar.length) await App.db.transacao(['insumos'], (l) => mudar.forEach((x) => l('insumos').put(x)));
    return mudar.length;
  }

  // Custo de uma lista de itens ({ insumoId, kg }). Se faltar preço de algum insumo, total e porKg ficam null
  // e semPreco lista os nomes (a tela mostra "sem preço", nunca zero ou conta errada).
  function custoItens(itens, insumosPorId) {
    let total = 0;
    const semPreco = [];
    let kg = 0;
    itens.forEach((it) => {
      kg += it.kg || 0;
      const ins = insumosPorId[it.insumoId];
      const p = precoKg(ins);
      if (p === null) { if (!semPreco.includes(ins ? ins.nome : '?')) semPreco.push(ins ? ins.nome : '?'); } else total += (it.kg || 0) * p;
    });
    const ok = !semPreco.length;
    return { total: ok ? total : null, porKg: ok && kg > 0 ? total / kg : null, semPreco, kg };
  }

  // Sal pronto para comparar (opcional na fórmula): R$/kg ou null
  function precoProntoKg(f) {
    return f && f.prontoPrecoSaco > 0 && f.prontoKgSaco > 0 ? f.prontoPrecoSaco / f.prontoKgSaco : null;
  }

  // kg feitos de cada fórmula nos últimos N dias (para a economia no mês)
  function kgPorFormula(misturas, dias, agora) {
    const desde = (agora || Date.now()) - dias * DIA;
    const kg = {};
    misturas.forEach((m) => { if (new Date(m.fim).getTime() >= desde) kg[m.formulaId] = (kg[m.formulaId] || 0) + (m.totalKg || 0); });
    return kg;
  }

  // Comparação da fórmula com o sal pronto: { fabKg, prontoKg, kg30, economiaMes } (valores null quando não dá para calcular)
  function comparaPronto(f, insumosPorId, misturas, agora) {
    const fabKg = custoItens(f.itens, insumosPorId).porKg;
    const prontoKg = precoProntoKg(f);
    const kg30 = kgPorFormula(misturas || [], 30, agora)[f.id] || 0;
    const economiaMes = fabKg !== null && prontoKg !== null ? kg30 * (prontoKg - fabKg) : null;
    return { fabKg, prontoKg, kg30, economiaMes };
  }

  // ---------- limite máximo por insumo (etapa 4.4) ----------
  // insumo.maxPct = máximo na mistura (%), preenchido pelo dono conforme o técnico. Sem valor = não confere.
  // Como a batida mantém a proporção, a % é a mesma em qualquer tamanho.
  function passaLimite(itens, insumosPorId) {
    const base = itens.reduce((s, it) => s + (it.kg > 0 ? it.kg : 0), 0);
    if (!base) return [];
    return itens.map((it) => {
      const ins = insumosPorId[it.insumoId];
      if (!ins || !(ins.maxPct > 0) || !(it.kg > 0)) return null;
      const pct = Math.round((it.kg / base) * 1000) / 10;
      return pct > ins.maxPct ? { insumoId: ins.id, nome: ins.nome, pct, max: ins.maxPct } : null;
    }).filter(Boolean);
  }

  // Limites estourados que o dono NÃO confirmou ao salvar a fórmula (ex.: o limite do insumo mudou depois)
  function limitesNaoConfirmados(f, insumosPorId) {
    const conf = f.limitesConfirmados || [];
    return passaLimite(f.itens, insumosPorId).filter((v) =>
      !conf.some((c) => c.insumoId === v.insumoId && c.max === v.max && Math.abs(c.pct - v.pct) < 0.05));
  }

  // "Ureia: 18% — limite 10%"
  const textoLimite = (v) => `${v.nome}: ${numero(v.pct)}% — limite ${numero(v.max)}%`;

  // ---------- tipo, época e lote ----------
  // formula.tipo: 'mineral' | 'proteinado' | 'outro' (sem tipo = fórmula antiga, ainda não marcada)
  // formula.epoca: 'aguas' | 'seca' | 'ano' (sem época = ano todo)
  // pasto.formulaAguasId / pasto.formulaSecaId: o sal de cada lote em cada época (opcional)
  // config 'epocaAtual' ('aguas' | 'seca', marcada pelo dono) e 'mesesEpoca' ({ inicioSeca, inicioAguas }, 1 a 12, opcional)
  // Cores dos tipos: nunca verde/amarelo/vermelho (essas são de alerta) nem a terra da marca.
  const TIPOS = {
    mineral: { nome: 'SAL MINERAL', cor: '#1f4fa0', icone: 'cristal' },
    proteinado: { nome: 'PROTEINADO', cor: '#5b3a8a', icone: 'grao' },
    outro: { nome: 'OUTRO', cor: '#4a4636', icone: 'saco' },
  };
  const EPOCAS = {
    aguas: { nome: 'ÁGUAS', icone: 'gota', fala: 'das águas' },
    seca: { nome: 'SECA', icone: 'sol', fala: 'da seca' },
    ano: { nome: 'ANO TODO', icone: 'calendario', fala: 'do ano todo' },
  };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const epocaDaFormula = (f) => (f && EPOCAS[f.epoca] ? f.epoca : 'ano');

  // O sal que o lote deve receber na época marcada (id da fórmula) ou null
  function salDoLote(pasto, epocaAtual) {
    if (!pasto || !epocaAtual) return null;
    return (epocaAtual === 'seca' ? pasto.formulaSecaId : pasto.formulaAguasId) || null;
  }

  // No mês da troca marcado pelo dono, se a época ainda não foi trocada: { para: 'seca' | 'aguas' }. Só avisa.
  function avisoTrocaEpoca(epocaAtual, meses, agora) {
    if (!meses) return null;
    const mes = new Date(agora || Date.now()).getMonth() + 1;
    if (meses.inicioSeca === mes && epocaAtual !== 'seca') return { para: 'seca' };
    if (meses.inicioAguas === mes && epocaAtual !== 'aguas') return { para: 'aguas' };
    return null;
  }

  // ---------- tamanho da batida ----------
  // A receita da fórmula (itens em kg) é a batida BASE. O dono cadastra os tamanhos que o operador pode escolher
  // (f.tamanhos, em kg) e o padrão (f.tamanhoPadrao). Fórmula antiga sem tamanhos: um tamanho só, o da receita.

  function baseKg(f) {
    return Math.round(f.itens.reduce((s, it) => s + (it.kg || 0), 0) * 10) / 10;
  }

  function tamanhos(f) {
    const lista = (Array.isArray(f.tamanhos) ? f.tamanhos : []).filter((t) => t > 0);
    const unicos = [...new Set(lista.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b);
    return unicos.length ? unicos : [baseKg(f)];
  }

  function tamanhoPadrao(f) {
    const ts = tamanhos(f);
    if (ts.includes(f.tamanhoPadrao)) return f.tamanhoPadrao;
    const base = baseKg(f);
    return ts.includes(base) ? base : ts[ts.length - 1];
  }

  // A fórmula na proporção da receita, para o tamanho pedido (kg de cada insumo arredondados em 0,1 kg)
  function escalarFormula(f, tamanhoKg) {
    const base = baseKg(f);
    const fator = base > 0 ? tamanhoKg / base : 1;
    return Object.assign({}, f, {
      baseKg: base,
      tamanhoKg,
      itens: f.itens.map((it) => Object.assign({}, it, { kg: Math.round(it.kg * fator * 10) / 10 })),
    });
  }

  // ---------- mistura saco por saco ----------
  // A mistura em andamento fica guardada em config 'misturaAndamento' a cada toque (sobrevive ao app fechar).
  // m.alvos[k] = { n: sacos inteiros, resto: kg que sobra, kgPor } — fixados no começo da mistura.
  // m.colocado[k] = { unid: sacos já colocados, resto: true se a sobra em kg já foi colocada }.
  // O estoque baixa a cada saco colocado (e volta no −1), na mesma gravação do progresso.

  const CHAVE_ANDAMENTO = 'misturaAndamento';

  function alvoItem(kg, ins) {
    const { kgPor } = unidade(ins);
    if (!kgPor) return { n: 0, resto: Math.round(kg * 10) / 10, kgPor: 0 };
    const q = qtd(kg, ins);
    return { n: q.n, resto: q.resto, kgPor };
  }

  function novaMistura({ formula, insumosPorId, pessoa, avisoFalta }) {
    return {
      id: App.db.novoId('mistura'),
      formula: { id: formula.id, nome: formula.nome, numero: formula.numero, cor: formula.cor, corClara: formula.corClara,
        tamanhoKg: formula.tamanhoKg || baseKg(formula), baseKg: formula.baseKg || baseKg(formula),
        itens: formula.itens.map((it) => ({ insumoId: it.insumoId, kg: it.kg })) },
      alvos: formula.itens.map((it) => alvoItem(it.kg, insumosPorId[it.insumoId])),
      colocado: formula.itens.map(() => ({ unid: 0, resto: false })),
      insumos: insumosPorId,
      atual: 0,
      ordem: [],
      inicio: new Date().toISOString(),
      pessoaId: pessoa ? pessoa.id : null,
      pessoaNome: pessoa ? pessoa.nome : '',
      avisoFalta: avisoFalta || null,
      guardada: false, // true depois do 1º saco: aí aparece no Início se for interrompida
    };
  }

  // Situação de um insumo da mistura
  function progresso(m, k) {
    const a = m.alvos[k];
    const c = m.colocado[k];
    const completo = c.unid >= a.n && (a.resto <= 0 || c.resto);
    const kg = Math.round((c.unid * a.kgPor + (c.resto ? a.resto : 0)) * 10) / 10;
    return { n: a.n, resto: a.resto, kgPor: a.kgPor, unid: c.unid, restoFeito: c.resto, completo, kg, kgAlvo: m.formula.itens[k].kg };
  }

  function totalColocadoKg(m) {
    return m.formula.itens.reduce((s, _, k) => s + progresso(m, k).kg, 0);
  }

  // Grava o progresso (e baixa/devolve o estoque do que mudou). deltas = { insumoId: kg colocados a mais (ou − a menos) }
  async function gravarAndamento(m, deltas) {
    const ids = Object.keys(deltas || {}).filter((id) => Math.abs(deltas[id]) > 0.001);
    const alterados = [];
    for (const id of ids) {
      const ins = await App.db.pegar('insumos', id);
      if (!ins) continue;
      ins.estoqueKg = Math.round((ins.estoqueKg - deltas[id]) * 10) / 10;
      alterados.push(ins);
      if (m.insumos[id]) m.insumos[id].estoqueKg = ins.estoqueKg;
    }
    m.guardada = true;
    m.atualizadaEm = new Date().toISOString();
    const salvo = Object.assign({}, m);
    delete salvo.insumos; // as fotos ficam no cadastro; ao continuar, os insumos são lidos de novo
    await App.db.transacao(['insumos', 'config'], (l) => {
      alterados.forEach((i) => l('insumos').put(i));
      l('config').put({ chave: CHAVE_ANDAMENTO, valor: salvo });
    });
  }

  // Mistura parada (ou null). Com os insumos lidos de novo do cadastro.
  async function carregarAndamento() {
    const salvo = await App.db.config(CHAVE_ANDAMENTO);
    if (!salvo) return null;
    const insumos = await App.db.todos('insumos');
    const porId = {};
    insumos.forEach((i) => { porId[i.id] = i; });
    return Object.assign({}, salvo, { insumos: porId, faltaInsumo: salvo.formula.itens.some((it) => !porId[it.insumoId]) });
  }

  function apagarAndamento() {
    return App.db.apagar('config', CHAVE_ANDAMENTO);
  }

  // O que falta: [{ nome, texto: "8 sacos" }] só dos insumos incompletos
  function faltando(m) {
    return m.formula.itens.map((it, k) => {
      const p = progresso(m, k);
      if (p.completo) return null;
      const ins = m.insumos[it.insumoId] || { nome: '?' };
      const partes = [];
      if (p.unid < p.n) partes.push(`${p.n - p.unid} ${nomeUnidade(p.n - p.unid, ins)}`);
      if (p.resto > 0 && !p.restoFeito) partes.push(`${numero(p.resto)} kg`);
      return { nome: ins.nome, texto: partes.join(' + ') };
    }).filter(Boolean);
  }

  // Fecha a mistura: grava o registro com o que foi colocado DE FATO e apaga o andamento (tudo junto).
  // O estoque já baixou saco por saco. encerrada = o dono fechou uma mistura que ficou pela metade.
  async function concluirMistura(m, { destino, pessoa, encerrada }) {
    const itens = m.formula.itens.map((it, k) => {
      const p = progresso(m, k);
      const ins = m.insumos[it.insumoId];
      return {
        insumoId: it.insumoId, nome: ins ? ins.nome : '?', kg: p.kg, kgFormula: it.kg,
        unidades: p.unid, unidadesFormula: p.n, unidade: ins ? ins.unidade || 'saco' : 'saco',
      };
    });
    const completa = m.formula.itens.every((_, k) => progresso(m, k).completo);
    const reg = {
      id: m.id,
      formulaId: m.formula.id,
      formulaNome: m.formula.nome,
      itens,
      totalKg: Math.round(itens.reduce((s, it) => s + it.kg, 0) * 10) / 10,
      totalFormulaKg: Math.round(itens.reduce((s, it) => s + it.kgFormula, 0) * 10) / 10,
      tamanhoKg: m.formula.tamanhoKg || null, // tamanho da batida escolhido (a receita base pode ser outra)
      status: completa ? 'completa' : 'incompleta',
      encerradaPeloDono: !!encerrada,
      destino,
      pessoaId: m.pessoaId,
      pessoaNome: m.pessoaNome,
      inicio: m.inicio,
      fim: new Date().toISOString(),
      ordem: m.ordem,
      avisoFalta: m.avisoFalta,
      exemplo: false,
    };
    if (pessoa && pessoa.id !== m.pessoaId) { reg.terminadaPorId = pessoa.id; reg.terminadaPorNome = pessoa.nome; }
    await App.db.transacao(['misturas', 'config'], (l) => {
      l('misturas').put(reg);
      l('config').delete(CHAVE_ANDAMENTO);
    });
    return reg;
  }

  // Chegou insumo: soma ao estoque (sempre em kg) e registra a entrada (tudo junto).
  // kgPorUnidade = peso de cada saco desta compra. O peso mais recente vira o "saco atual" do insumo
  // (usado na mistura e para mostrar o estoque em sacos); o estoque não muda de valor, só de leitura.
  async function salvarEntrada({ insumo, quantidade, kgPorUnidade, pessoa }) {
    const ins = await App.db.pegar('insumos', insumo.id);
    const { kgPor, granel } = unidade(ins);
    const pesoCada = granel ? null : (kgPorUnidade > 0 ? kgPorUnidade : kgPor);
    const kg = granel ? quantidade : Math.round(quantidade * pesoCada * 10) / 10;
    ins.estoqueKg = Math.round((ins.estoqueKg + kg) * 10) / 10;
    const pesoDiferente = !granel && Math.abs(pesoCada - kgPor) > 0.05;
    if (pesoDiferente) ins.kgPorSaco = pesoCada; // saco atual = o da compra mais recente
    const entrada = {
      id: App.db.novoId('entrada'),
      insumoId: ins.id,
      insumoNome: ins.nome,
      quantidade,
      unidade: ins.unidade || 'saco',
      kgPorUnidade: pesoCada, // peso de cada saco nesta chegada
      kgPorUnidadeCadastro: granel ? null : kgPor, // saco atual ANTES desta chegada
      pesoDiferente, // true = esta chegada mudou o saco atual
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
    DIA, DIAS_PAINEL, DIAS_COMPRA, PESOS_COMUNS, UNIDADES, numero, unidade, nomeUnidade, qtd, qtdTexto, qtdFala, consumoDiario,
    situacaoEstoque, alertasEstoque, painel, faltas,
    precoKg, converterPrecosParaKg, custoItens, precoProntoKg, kgPorFormula, comparaPronto, passaLimite, limitesNaoConfirmados, textoLimite,
    TIPOS, EPOCAS, MESES, epocaDaFormula, salDoLote, avisoTrocaEpoca,
    baseKg, tamanhos, tamanhoPadrao, escalarFormula,
    montarMistura, novaMistura, progresso, totalColocadoKg, gravarAndamento, carregarAndamento, apagarAndamento,
    faltando, concluirMistura, salvarEntrada, iniciais, quando,
  };
})();
