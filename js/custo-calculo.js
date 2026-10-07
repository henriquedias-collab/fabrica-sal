// CUSTO DO QUE ESTÁ NO GALPÃO — só o CÁLCULO (sem tela, sem banco, sem navegador), igual ao resumo-calculo.js.
// Cada chegada é um "lote" no galpão, com o preço pago (R$/kg) quando o dono informou. O que sai (misturas, contagem
// a menos) sai primeiro dos lotes mais antigos. O custo de uma mistura = média ponderada dos lotes que ainda estão
// no galpão naquele momento.
// Se algum lote não tem preço pago (chegada sem preço, ou o estoque que já existia antes do app), ele entra pelo
// preço cadastrado do insumo e o custo fica marcado como ESTIMADO. Sem lote nenhum: preço cadastrado, estimado.
// Sem preço de jeito nenhum: precoKg = null ("sem preço").
(function (raiz) {
  const t = (iso) => new Date(iso).getTime();
  const POUCO = 0.05; // kg: abaixo disso o lote acabou

  // R$/kg cadastrado (precoKg; cadastro antigo: preço do saco ÷ kg do saco) ou null
  function precoCadastro(ins) {
    if (!ins) return null;
    if (ins.precoKg !== undefined && ins.precoKg !== null) return ins.precoKg > 0 ? ins.precoKg : null;
    if (!(ins.precoPorUnidade > 0)) return null;
    const k = ins.unidade !== 'kg' && ins.kgPorSaco > 0 ? ins.kgPorSaco : 0;
    return k ? ins.precoPorUnidade / k : ins.precoPorUnidade;
  }

  // Tudo o que mexeu no estoque do insumo, em ordem de tempo
  function eventos(insumoId, dados) {
    const ev = [];
    (dados.entradas || []).forEach((e) => {
      if (e.insumoId === insumoId && e.kg > 0) ev.push({ t: t(e.quando), kg: e.kg, preco: e.precoKg > 0 ? e.precoKg : null, entrada: true });
    });
    (dados.misturas || []).forEach((m) => (m.itens || []).forEach((it) => {
      if (it.insumoId === insumoId && it.kg > 0) ev.push({ t: t(m.fim), kg: -it.kg, misturaId: m.id });
    }));
    (dados.contagens || []).forEach((c) => {
      const d = (c.depoisKg || 0) - (c.antesKg || 0);
      if (c.insumoId === insumoId && Math.abs(d) > POUCO) ev.push({ t: t(c.quando), kg: d, contagem: true });
    });
    return ev.sort((a, b) => a.t - b.t || (a.entrada ? -1 : 0) - (b.entrada ? -1 : 0));
  }

  // Lotes no galpão logo antes da mistura (ou de "agora", se mistura = null)
  function lotesAntes(ins, dados, mistura) {
    const ev = eventos(ins.id, dados);
    // O que já estava no galpão antes do primeiro registro (sem preço pago): estoque de hoje − tudo o que mexeu
    const soma = ev.reduce((s, e) => s + e.kg, 0);
    const inicial = (ins.estoqueKg || 0) - soma;
    const lotes = inicial > POUCO ? [{ kg: inicial, preco: null, inicial: true }] : [];
    const limite = mistura ? t(mistura.fim) : Infinity;
    for (const e of ev) {
      if (mistura && e.misturaId === mistura.id) continue;
      if (e.t > limite) break;
      if (e.entrada) { lotes.push({ kg: e.kg, preco: e.preco }); continue; }
      if (e.kg > 0) { // contagem achou a mais: soma ao lote mais novo (ou vira lote sem preço)
        if (lotes.length) lotes[lotes.length - 1].kg += e.kg; else lotes.push({ kg: e.kg, preco: null });
        continue;
      }
      let falta = -e.kg; // saída: tira dos lotes mais antigos primeiro
      while (falta > POUCO && lotes.length) {
        const l = lotes[0];
        const tira = Math.min(l.kg, falta);
        l.kg -= tira; falta -= tira;
        if (l.kg <= POUCO) lotes.shift();
      }
    }
    return lotes;
  }

  // Custo do kg de um insumo numa mistura: { precoKg (null = sem preço), estimado }
  function custoNaMistura(ins, dados, mistura) {
    const cad = precoCadastro(ins);
    if (!ins) return { precoKg: null, estimado: true };
    const lotes = lotesAntes(ins, dados, mistura);
    const total = lotes.reduce((s, l) => s + l.kg, 0);
    const pagos = lotes.filter((l) => l.preco !== null);
    if (total <= POUCO || !pagos.length) return { precoKg: cad, estimado: true };
    const semPreco = lotes.filter((l) => l.preco === null).reduce((s, l) => s + l.kg, 0);
    const valorPago = pagos.reduce((s, l) => s + l.kg * l.preco, 0);
    if (semPreco <= POUCO) return { precoKg: valorPago / (total - semPreco), estimado: false };
    const medioPago = valorPago / (total - semPreco);
    return { precoKg: (valorPago + semPreco * (cad !== null ? cad : medioPago)) / total, estimado: true };
  }

  // Preço de cada item da mistura: devolve os itens com precoKg e precoEstimado.
  // dados = { insumos, entradas, misturas (pode incluir a própria mistura), contagens }
  function precificar(mistura, dados) {
    const insPorId = {};
    (dados.insumos || []).forEach((i) => { insPorId[i.id] = i; });
    return (mistura.itens || []).map((it) => {
      const c = custoNaMistura(insPorId[it.insumoId], dados, mistura);
      return Object.assign({}, it, { precoKg: c.precoKg === null ? null : Math.round(c.precoKg * 10000) / 10000, precoEstimado: c.estimado });
    });
  }

  // Custo médio de hoje do que está no galpão (para mostrar no cadastro, se precisar)
  function custoHoje(ins, dados) {
    return custoNaMistura(ins, dados, null);
  }

  const api = { precificar, custoNaMistura, custoHoje, lotesAntes, precoCadastro };
  if (raiz.App) raiz.App.custoCalc = api; // no app (navegador)
  raiz.CochoCusto = api; // fora do app (ex.: Google Apps Script)
})(typeof window !== 'undefined' ? (window.App = window.App || {}, window) : this);
