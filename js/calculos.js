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

  // Insumos que pedem atenção no Início, do pior para o menos grave
  async function alertasEstoque() {
    const [insumos, misturas] = await Promise.all([App.db.todos('insumos'), App.db.todos('misturas')]);
    const consumo = consumoDiario(misturas);
    return insumos
      .map((i) => {
        const porDia = consumo[i.id] || 0;
        const dias = porDia > 0 ? Math.floor(i.estoqueKg / porDia) : null;
        let nivel = null;
        if (i.estoqueKg <= 0) nivel = 'vermelho';
        else if (dias !== null && dias < PERIGO_DIAS) nivel = 'vermelho';
        else if (dias !== null && dias < ALERTA_DIAS) nivel = 'laranja';
        else if (i.estoqueKg < (i.estoqueMinimoKg || 0)) nivel = 'laranja';
        return { insumo: i, dias, nivel };
      })
      .filter((a) => a.nivel)
      .sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel === 'vermelho' ? -1 : 1;
        return (a.dias ?? 999) - (b.dias ?? 999);
      });
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
    DIA, UNIDADES, numero, unidade, nomeUnidade, qtd, qtdTexto, qtdFala, consumoDiario, alertasEstoque, faltas,
    montarMistura, salvarMistura, iniciais, quando,
  };
})();
