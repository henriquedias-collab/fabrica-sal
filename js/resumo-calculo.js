// RESUMO DA SEMANA — só o CÁLCULO (sem tela, sem banco, sem navegador).
// Recebe os dados como listas comuns e devolve um objeto simples (JSON). Assim o mesmo código pode rodar,
// no futuro, na nuvem (Google Apps Script) para o envio automático. Não use window, document nem App.db aqui.
// Valores que não dá para calcular (falta preço ou dado) voltam como null — a tela mostra "sem dado", nunca zero.
(function (raiz) {
  const DIA = 24 * 60 * 60 * 1000;
  const DIAS_ESTOQUE_ALERTA = 15; // "o que acaba em até 15 dias"
  const DIAS_CONSUMO = 14; // consumo médio dos últimos 14 dias (igual ao app)
  const DIAS_COMPRA = 30; // lista de compras: 30 dias de produção + estoque mínimo
  const TOLERANCIA_META = 0.1; // até 10% da meta = normal

  const t = (iso) => new Date(iso).getTime();
  const r1 = (x) => Math.round(x * 10) / 10;

  // Saco atual do insumo (kg) — a granel = 0
  function kgSaco(ins) {
    return ins && ins.unidade !== 'kg' && ins.kgPorSaco > 0 ? ins.kgPorSaco : 0;
  }
  // R$/kg (cadastro novo: precoKg; antigo: preço do saco ÷ kg do saco) ou null
  function precoKg(ins) {
    if (!ins) return null;
    if (ins.precoKg !== undefined) return ins.precoKg > 0 ? ins.precoKg : null;
    if (!(ins.precoPorUnidade > 0)) return null;
    const k = kgSaco(ins);
    return k ? ins.precoPorUnidade / k : ins.precoPorUnidade;
  }
  // Custo de itens de uma mistura [{ insumoId, kg, precoKg?, precoEstimado? }]: usa o custo GRAVADO na mistura
  // (custo médio do galpão naquele dia, custo-calculo.js). Mistura antiga, sem custo gravado: preço de hoje = estimado.
  // null se faltar preço de algum insumo (semPreco lista os nomes). estimado = algum item não veio do preço pago.
  // porItem: o custo de cada item ({ insumoId, nome, kg, reais (null = sem preço), estimado }).
  function custo(itens, insPorId) {
    let total = 0;
    let estimado = false;
    const semPreco = [];
    const porItem = [];
    (itens || []).forEach((it) => {
      const ins = insPorId[it.insumoId];
      const gravado = typeof it.precoKg === 'number' && it.precoKg > 0;
      const p = gravado ? it.precoKg : precoKg(ins);
      const est = !gravado || !!it.precoEstimado;
      if (est) estimado = true;
      const nome = ins ? ins.nome : (it.nome || '?');
      if (p === null) { if (!semPreco.includes(nome)) semPreco.push(nome); } else total += (it.kg || 0) * p;
      porItem.push({ insumoId: it.insumoId, nome, kg: it.kg || 0, reais: p === null ? null : (it.kg || 0) * p, estimado: est && (it.kg || 0) > 0 });
    });
    return { total: semPreco.length ? null : total, semPreco, estimado: estimado && (itens || []).some((it) => (it.kg || 0) > 0), porItem };
  }

  // Soma o gasto de cada insumo (lista de porItem): [{ insumoId, nome, kg, reais|null, estimado }], o maior primeiro
  function somarPorInsumo(listas) {
    const m = {};
    listas.forEach((l) => l.forEach((x) => {
      if (!(x.kg > 0)) return;
      const a = m[x.insumoId] || (m[x.insumoId] = { insumoId: x.insumoId, nome: x.nome, kg: 0, reais: 0, estimado: false });
      a.kg += x.kg;
      a.reais = a.reais === null || x.reais === null ? null : a.reais + x.reais;
      if (x.estimado) a.estimado = true;
    }));
    return Object.values(m).map((a) => Object.assign(a, { kg: Math.round(a.kg * 10) / 10 }))
      .sort((a, b) => (b.reais === null ? -1 : b.reais) - (a.reais === null ? -1 : a.reais) || b.kg - a.kg);
  }

  // Segunda-feira 00:00 da semana de uma data (hora local)
  function inicioDaSemana(data) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    const diaSemana = (d.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
    d.setDate(d.getDate() - diaSemana);
    return d.getTime();
  }
  const ddmm = (ms) => { const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

  // Números de uma semana (usado para a semana pedida e para a anterior)
  function numerosDaSemana(dados, inicio, agora, insPorId) {
    const fimSemana = inicio + 7 * DIA; // exclusivo (segunda seguinte 00:00)
    const fim = Math.min(fimSemana, agora);
    const dias = Math.max(1, Math.min(7, Math.ceil((fim - inicio) / DIA))); // semana em andamento: só os dias que passaram
    const misturas = dados.misturas.filter((m) => t(m.fim) >= inicio && t(m.fim) < fimSemana);

    // Gasto: insumos colocados nas misturas da semana, pelo custo gravado em cada mistura
    let gasto = 0;
    let gastoEstimado = false;
    const semPreco = [];
    const itensSemana = [];
    misturas.forEach((m) => {
      const c = custo(m.itens, insPorId);
      itensSemana.push(c.porItem);
      if (c.estimado) gastoEstimado = true;
      c.semPreco.forEach((n) => { if (!semPreco.includes(n)) semPreco.push(n); });
      if (c.total !== null) gasto += c.total;
    });
    const kgFeitos = misturas.reduce((s, m) => s + (m.totalKg || 0), 0);
    const porInsumo = somarPorInsumo(itensSemana); // gasto de cada insumo na semana
    const custoKgSal = !semPreco.length && kgFeitos > 0 ? gasto / kgFeitos : null; // R$ por kg de sal feito

    // Por lote: kg mandados, g/cabeça/dia, custo/cabeça/dia e comparação com a meta da época
    const lotes = dados.pastos.slice().sort((a, b) => (a.numero || 0) - (b.numero || 0)).map((p) => {
      const daqui = misturas.filter((m) => m.destino && m.destino.tipo === 'pasto' && m.destino.id === p.id);
      const kg = daqui.reduce((s, m) => s + (m.totalKg || 0), 0);
      let custoLote = 0;
      let custoOk = true;
      let custoEstimado = false;
      daqui.forEach((m) => { const c = custo(m.itens, insPorId); if (c.estimado) custoEstimado = true; if (c.total === null) custoOk = false; else custoLote += c.total; });
      const cab = p.cabecas > 0 ? p.cabecas : 0;
      const gramas = cab && kg > 0 ? Math.round((kg * 1000) / cab / dias) : null;
      const custoCabDia = cab && kg > 0 && custoOk ? custoLote / cab / dias : null;
      const meta = dados.epoca === 'seca' ? p.metaSecaG : dados.epoca === 'aguas' ? p.metaAguasG : null;
      let nivel = null; // 'acima' | 'normal' | 'abaixo' | null (sem meta ou sem consumo)
      if (meta > 0 && gramas !== null) {
        const dif = gramas / meta - 1;
        nivel = Math.abs(dif) <= TOLERANCIA_META ? 'normal' : dif > 0 ? 'acima' : 'abaixo';
      }
      return { id: p.id, numero: p.numero, nome: p.nome, cor: p.cor, cabecas: cab, kg, gramas, meta: meta > 0 ? meta : null, nivel, custo: custoOk ? custoLote : null, custoEstimado, custoCabDia };
    });

    // Custo por cabeça por dia (todos os lotes que receberam sal)
    const comSal = lotes.filter((l) => l.kg > 0 && l.cabecas > 0);
    const cabTotal = comSal.reduce((s, l) => s + l.cabecas, 0);
    const custoCabDia = comSal.length && comSal.every((l) => l.custo !== null) && cabTotal
      ? comSal.reduce((s, l) => s + l.custo, 0) / cabTotal / dias : null;

    // Perdas: problemas da semana (kg informado pelo dono) + o que sumiu nas contagens de estoque
    const problemas = dados.problemas.filter((p) => t(p.quando) >= inicio && t(p.quando) < fimSemana)
      .sort((a, b) => a.quando.localeCompare(b.quando))
      .map((p) => {
        const ins = insPorId[p.insumoId];
        const kg = p.perdaKg > 0 ? p.perdaKg : null;
        const pk = precoKg(ins);
        return {
          id: p.id, tipo: p.tipo, quando: p.quando, pessoaNome: p.pessoaNome || '', insumoId: p.insumoId || null,
          insumoNome: p.insumoNome || (p.faltas && p.faltas.length ? p.faltas.map((f) => f.nome).join(', ') : null),
          temFoto: !!p.foto, resolvido: !!p.resolvidoEm,
          podeTerPerda: !!p.insumoId && ['saco-rasgado', 'molhado'].includes(p.tipo),
          kg, reais: kg !== null && pk !== null ? kg * pk : null,
        };
      });
    const sumicos = dados.contagens
      .filter((c) => c.tipo !== 'inicial' && t(c.quando) >= inicio && t(c.quando) < fimSemana && c.antesKg - c.depoisKg > 0.05)
      .map((c) => {
        const kg = r1(c.antesKg - c.depoisKg);
        const pk = precoKg(insPorId[c.insumoId]);
        return { id: c.id, quando: c.quando, insumoId: c.insumoId, insumoNome: c.insumoNome, kg, reais: pk !== null ? kg * pk : null };
      });
    const comPerda = problemas.filter((p) => p.podeTerPerda);
    const perdasItens = comPerda.map((p) => p).concat(sumicos);
    const perdaKgConhecida = perdasItens.filter((x) => x.kg !== null).reduce((s, x) => s + x.kg, 0);
    const faltaKg = comPerda.some((p) => p.kg === null); // algum saco rasgado/molhado sem kg informado
    const faltaReais = perdasItens.some((x) => x.kg !== null && x.reais === null) || faltaKg;
    const perdas = {
      quantidade: problemas.length,
      problemas,
      sumicos,
      kg: perdasItens.length ? (faltaKg ? null : r1(perdaKgConhecida)) : 0,
      kgConhecido: r1(perdaKgConhecida),
      reais: perdasItens.length ? (faltaReais ? null : perdasItens.reduce((s, x) => s + x.reais, 0)) : 0,
    };

    return {
      inicio, fim: fimSemana, dias, emAndamento: agora < fimSemana,
      misturas: misturas.length, kgFeitos,
      gasto: semPreco.length ? null : gasto, gastoEstimado: gastoEstimado && !semPreco.length, semPreco, porInsumo, custoKgSal,
      custoCabDia, custoCabDiaEstimado: custoCabDia !== null && comSal.some((l) => l.custoEstimado), lotes, perdas,
    };
  }

  // Estoque de HOJE: o que acaba em até 15 dias (ou está abaixo do mínimo) e quanto comprar
  function estoqueHoje(dados, agora, insPorId) {
    const desde = agora - DIAS_CONSUMO * DIA;
    const usado = {};
    dados.misturas.filter((m) => t(m.fim) >= desde && t(m.fim) <= agora)
      .forEach((m) => m.itens.forEach((it) => { usado[it.insumoId] = (usado[it.insumoId] || 0) + (it.kg || 0); }));
    return dados.insumos.map((i) => {
      const porDia = (usado[i.id] || 0) / DIAS_CONSUMO;
      const estoque = Math.max(0, i.estoqueKg || 0);
      const dias = porDia > 0 ? Math.floor(estoque / porDia) : null;
      const abaixoMinimo = estoque < (i.estoqueMinimoKg || 0);
      const acaba = estoque <= 0 || (dias !== null && dias <= DIAS_ESTOQUE_ALERTA) || abaixoMinimo;
      if (!acaba) return null;
      const faltaKg = porDia * DIAS_COMPRA + (i.estoqueMinimoKg || 0) - estoque;
      const k = kgSaco(i);
      const unidades = faltaKg > 0.05 ? (k ? Math.ceil(faltaKg / k - 1e-9) : Math.ceil(faltaKg)) : 0;
      const kgComprar = k ? unidades * k : unidades;
      const pk = precoKg(i);
      const nivel = estoque <= 0 || (dias !== null && dias < 3) ? 'vermelho' : 'laranja';
      return {
        id: i.id, nome: i.nome, estoqueKg: estoque, kgSaco: k, dias, abaixoMinimo, nivel,
        comprarUnidades: unidades, comprarKg: kgComprar, comprarReais: unidades && pk !== null ? kgComprar * pk : (unidades ? null : 0),
      };
    }).filter(Boolean).sort((a, b) => (a.dias ?? -1) - (b.dias ?? -1));
  }

  // Variação para a comparação com a semana anterior: { atual, anterior, dif, pct } (null quando falta dado)
  function variacao(atual, anterior) {
    if (atual === null || anterior === null || atual === undefined || anterior === undefined) return { atual, anterior, dif: null, pct: null };
    return { atual, anterior, dif: atual - anterior, pct: anterior ? (atual - anterior) / anterior : null };
  }

  // ENTRADA: dados = { misturas, insumos, pastos, problemas, contagens, epoca, nomeFazenda }
  //          opcoes = { semana: data qualquer dentro da semana (padrão: a última semana completa), agora }
  // SAÍDA: objeto simples (pode virar JSON e ir para a nuvem)
  function calcular(dados, opcoes) {
    const o = opcoes || {};
    const agora = o.agora || Date.now();
    const inicio = inicioDaSemana(o.semana !== undefined ? o.semana : agora - 7 * DIA);
    const insPorId = {};
    dados.insumos.forEach((i) => { insPorId[i.id] = i; });
    const semana = numerosDaSemana(dados, inicio, agora, insPorId);
    const anterior = numerosDaSemana(dados, inicio - 7 * DIA, agora, insPorId);
    const fimDomingo = semana.fim - DIA;
    return {
      versao: 1,
      nomeFazenda: dados.nomeFazenda || '',
      epoca: dados.epoca || null,
      periodo: { inicio, fim: semana.fim, rotulo: `${ddmm(inicio)} a ${ddmm(fimDomingo)}`, emAndamento: semana.emAndamento, dias: semana.dias },
      semana,
      anterior,
      estoque: estoqueHoje(dados, agora, insPorId),
      comparacao: {
        gasto: variacao(semana.gasto, anterior.gasto),
        kgFeitos: variacao(semana.kgFeitos, anterior.kgFeitos),
        misturas: variacao(semana.misturas, anterior.misturas),
        custoCabDia: variacao(semana.custoCabDia, anterior.custoCabDia),
        perdasReais: variacao(semana.perdas.reais, anterior.perdas.reais),
        problemas: variacao(semana.perdas.quantidade, anterior.perdas.quantidade),
      },
      geradoEm: new Date(agora).toISOString(),
    };
  }

  // GASTO POR SEMANA: todas as semanas desde a primeira mistura até a semana de hoje (a mais nova primeiro),
  // com o total geral. Mesmas contas do resumo da semana. ENTRADA: os mesmos dados de calcular().
  function historico(dados, opcoes) {
    const agora = (opcoes && opcoes.agora) || Date.now();
    const insPorId = {};
    dados.insumos.forEach((i) => { insPorId[i.id] = i; });
    const datas = dados.misturas.map((m) => t(m.fim)).filter((x) => x <= agora);
    const semanas = [];
    if (datas.length) {
      const primeira = inicioDaSemana(Math.min(...datas));
      for (let ini = inicioDaSemana(agora); ini >= primeira; ini = inicioDaSemana(ini - 3 * DIA)) {
        const s = numerosDaSemana(dados, ini, agora, insPorId);
        const domingo = s.fim - DIA;
        semanas.push({
          inicio: ini, rotulo: `${ddmm(ini)} a ${ddmm(domingo)}`, ano: new Date(domingo).getFullYear(),
          emAndamento: s.emAndamento, dias: s.dias,
          misturas: s.misturas, kgFeitos: s.kgFeitos, gasto: s.gasto, gastoEstimado: s.gastoEstimado, semPreco: s.semPreco,
          porInsumo: s.porInsumo, custoKgSal: s.custoKgSal,
          problemas: s.perdas.quantidade, perdasKg: s.perdas.kg, perdasReais: s.perdas.reais,
          custoCabDia: s.custoCabDia, custoCabDiaEstimado: s.custoCabDiaEstimado,
        });
      }
    }
    const soma = (campo) => semanas.reduce((a, s) => a + (s[campo] || 0), 0);
    const comCusto = semanas.filter((s) => s.custoCabDia !== null);
    const comGasto = semanas.filter((s) => s.gasto !== null && s.kgFeitos > 0);
    const kgComGasto = comGasto.reduce((a, s) => a + s.kgFeitos, 0);
    return {
      versao: 1,
      nomeFazenda: dados.nomeFazenda || '',
      semanas,
      total: {
        semanas: semanas.length,
        desde: semanas.length ? semanas[semanas.length - 1].inicio : null,
        misturas: soma('misturas'), kgFeitos: soma('kgFeitos'), problemas: soma('problemas'),
        gasto: soma('gasto'), gastoIncompleto: semanas.some((s) => s.gasto === null), gastoEstimado: semanas.some((s) => s.gastoEstimado),
        perdasReais: soma('perdasReais'), perdasIncompleto: semanas.some((s) => s.perdasReais === null),
        // média das semanas que têm custo por cabeça
        custoCabDia: comCusto.length ? comCusto.reduce((a, s) => a + s.custoCabDia, 0) / comCusto.length : null,
        custoCabDiaEstimado: comCusto.some((s) => s.custoCabDiaEstimado),
        // gasto de cada insumo somando todas as semanas e o R$/kg de sal das semanas que têm gasto
        porInsumo: somarPorInsumo(semanas.map((s) => s.porInsumo)),
        custoKgSal: kgComGasto > 0 ? comGasto.reduce((a, s) => a + s.gasto, 0) / kgComGasto : null,
      },
      geradoEm: new Date(agora).toISOString(),
    };
  }

  // MENSAGEM CURTA para o WhatsApp (3 a 5 linhas com os números principais). Entra o resultado de calcular().
  // Também é pura: o envio automático na nuvem usa a mesma mensagem.
  function mensagem(r) {
    const num = (x, casas) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0 });
    const reais = (v, casas) => (v === null || v === undefined ? 'sem dado' : 'R$ ' + num(v, casas));
    const s = r.semana;
    const p = s.perdas;
    const ano = new Date(r.periodo.inicio).getFullYear();
    const linhas = [
      `*Cocho${r.nomeFazenda ? ' - ' + r.nomeFazenda : ''}* - Resumo de ${r.periodo.rotulo}/${ano}${r.periodo.emAndamento ? ' (até hoje)' : ''}`,
      `Gasto: ${reais(s.gasto)}${s.gastoEstimado ? " (estimado)" : ""} · ${s.misturas} ${s.misturas === 1 ? 'mistura' : 'misturas'} · ${num(s.kgFeitos)} kg de sal`,
      `Problemas: ${p.quantidade} · perdas ${p.reais === null ? 'sem dado' : reais(p.reais)}`,
      `Custo por cabeça/dia: ${reais(s.custoCabDia, 2)}`,
    ];
    const fora = s.lotes.filter((l) => l.nivel === 'acima' || l.nivel === 'abaixo').map((l) => `${l.nome} ${l.nivel}`);
    const acabando = r.estoque.map((e) => e.nome);
    const alerta = [];
    if (acabando.length) alerta.push(`Acabando: ${acabando.slice(0, 3).join(', ')}${acabando.length > 3 ? '...' : ''}`);
    if (fora.length) alerta.push(`Fora da meta: ${fora.slice(0, 2).join(', ')}${fora.length > 2 ? '...' : ''}`);
    if (alerta.length) linhas.push(alerta.join(' · '));
    return linhas.join('\n');
  }

  // MENSAGEM CURTA do GASTO POR SEMANA (entra o resultado de historico())
  function mensagemHistorico(h) {
    const num = (x, casas) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0 });
    const tt = h.total;
    const est = (b) => (b ? ' (estimado)' : '');
    const desde = tt.desde ? ddmm(tt.desde) + '/' + new Date(tt.desde).getFullYear() : '-';
    const linhas = [
      `*Cocho${h.nomeFazenda ? ' - ' + h.nomeFazenda : ''}* - Gasto por semana desde ${desde}`,
      `Total: R$ ${num(tt.gasto)}${tt.gastoIncompleto ? ' + sem dado' : ''}${est(tt.gastoEstimado)} · ${tt.semanas} ${tt.semanas === 1 ? 'semana' : 'semanas'} · ${num(tt.kgFeitos)} kg de sal`,
      `Média por semana: R$ ${num(tt.semanas ? tt.gasto / tt.semanas : 0)}`,
    ];
    const ultima = h.semanas.find((s) => !s.emAndamento);
    if (ultima) linhas.push(`Última semana (${ultima.rotulo}): ${ultima.gasto === null ? 'sem dado' : 'R$ ' + num(ultima.gasto)}${est(ultima.gastoEstimado)}`);
    return linhas.join('\n');
  }

  const api = { calcular, historico, mensagem, mensagemHistorico, custoMistura: custo, inicioDaSemana, DIA };
  if (raiz.App) raiz.App.resumoCalc = api; // no app (navegador)
  raiz.CochoResumo = api; // fora do app (ex.: Google Apps Script)
})(typeof window !== 'undefined' ? (window.App = window.App || {}, window) : this);
