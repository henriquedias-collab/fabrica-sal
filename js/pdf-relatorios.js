// RELATÓRIOS EM PDF PARA LER (várias páginas), com as peças de pdf.js (App.pdf.Relatorio) e o visual Cocho.
// "PDF PARA LER" da tela EXPORTAR CÓPIA: tudo o que está no celular, para gente ler.
// A cópia de segurança continua sendo o arquivo .cocho (dados); este PDF não serve para restaurar.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const P = () => App.pdf;

  const ddmm = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const ddmmaa = (iso) => `${ddmm(iso)}/${String(new Date(iso).getFullYear()).slice(2)}`;
  const hora = (iso) => { const d = new Date(iso); return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`; };
  const recentes = (lista, campo) => lista.slice().sort((a, b) => String(b[campo]).localeCompare(String(a[campo])));

  // Foto pequena para o PDF (JPEG quadrado, leve): o PDF fica pequeno mesmo com muitas fotos
  function miniatura(dataUrl, lado) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const menor = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = lado; c.height = lado;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, lado, lado);
        g.drawImage(img, (img.naturalWidth - menor) / 2, (img.naturalHeight - menor) / 2, menor, menor, 0, 0, lado, lado);
        ok(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => ok(null);
      img.src = dataUrl;
    });
  }

  const MAX_LINHAS = 40; // últimas misturas, chegadas e problemas

  const cabecalhoTabela = (rel, cols) => rel.linha(cols.map((c) => Object.assign({}, c, { cor: P().COR.tinta2, b: true })), { tam: 8, alt: 6 });

  // MISTURAS: data, sal, kg, destino, quem fez e o custo (gravado na mistura; "est." = estimado)
  function secaoMisturas(rel, misturas, insPorId, op) {
    const { kg, reais, COR } = P();
    const ms = recentes(misturas, 'fim');
    const max = op.max || ms.length;
    if (!rel.secao(op.titulo || 'Misturas', `${Math.min(ms.length, max)} de ${ms.length} · custo do dia de cada mistura`)) return;
    cabecalhoTabela(rel, [{ t: 'Data', w: 0.13 }, { t: 'Sal', w: 0.23 }, { t: 'Kg', w: 0.1, al: 'right' }, { t: '', w: 0.02 }, { t: 'Destino', w: 0.22 }, { t: 'Quem fez', w: 0.13 }, { t: 'Custo', w: 0.17, al: 'right' }]);
    let estimado = false;
    ms.slice(0, max).forEach((m) => {
      const d = m.destino;
      const destino = !d || d.tipo === 'nenhum' ? 'sem destino' : d.tipo === 'deposito' ? 'Depósito' : `Pasto ${d.numero} · ${d.nome}`;
      const c = A.resumoCalc.custoMistura(m.itens || [], insPorId);
      if (c.estimado && c.total !== null) estimado = true;
      rel.linha([
        { t: `${ddmmaa(m.fim)} ${hora(m.fim)}`, w: 0.13, cor: COR.tinta2, tam: 8.5 },
        { t: m.formulaNome + (m.status === 'incompleta' ? ' (incompleta)' : ''), w: 0.23, b: true, tam: 9.5 },
        { t: kg(m.totalKg), w: 0.1, al: 'right', tam: 10 }, { t: '', w: 0.02 },
        { t: destino + (d && d.foraDoPlano ? ' (fora do plano)' : ''), w: 0.22, tam: 9 },
        { t: m.pessoaNome || '-', w: 0.13, cor: COR.tinta2, tam: 9 },
        { t: c.total === null ? null : reais(c.total, 0) + (c.estimado ? ' est.' : ''), w: 0.17, al: 'right', tam: 10 },
      ]);
    });
    if (!ms.length) rel.frase('Nenhuma mistura registrada.');
    if (estimado) rel.frase('est. = estimado: alguma compra sem preço pago (ou mistura antiga) usou o preço cadastrado.');
    rel.y += 3;
  }

  // CHEGADAS: data, insumo, quanto, preço pago e quem recebeu
  function secaoChegadas(rel, entradas, op) {
    const { reais, COR } = P();
    const es = recentes(entradas, 'quando');
    const max = op.max || es.length;
    if (!rel.secao('Chegadas de insumo', `${Math.min(es.length, max)} de ${es.length}`)) return;
    cabecalhoTabela(rel, [{ t: 'Data', w: 0.13 }, { t: 'Insumo', w: 0.25 }, { t: 'Quanto', w: 0.32 }, { t: 'Preço pago', w: 0.15, al: 'right' }, { t: '', w: 0.02 }, { t: 'Recebido por', w: 0.13 }]);
    es.slice(0, max).forEach((e) => {
      rel.linha([
        { t: `${ddmmaa(e.quando)} ${hora(e.quando)}`, w: 0.13, cor: COR.tinta2, tam: 8.5 },
        { t: e.insumoNome, w: 0.25, b: true, tam: 9.5 },
        { t: e.texto, w: 0.32, tam: 9 },
        e.precoKg > 0 ? { t: reais(e.precoKg, 2) + '/kg', w: 0.15, al: 'right', tam: 9.5 } : { t: 'SEM PREÇO', w: 0.15, selo: 'laranja', al: 'right' },
        { t: '', w: 0.02 },
        { t: e.pessoaNome || '-', w: 0.13, cor: COR.tinta2, tam: 9 },
      ]);
    });
    if (!es.length) rel.frase('Nenhuma chegada registrada.');
    rel.y += 3;
  }

  // PROBLEMAS (com foto pequena). op.abertos = só os abertos
  async function secaoProblemas(rel, problemas, op) {
    const { kg, COR } = P();
    const todos = recentes(problemas, 'quando').filter((p) => !op.abertos || !p.resolvidoEm);
    const max = op.max || todos.length;
    const abertos = todos.filter((p) => !p.resolvidoEm).length;
    if (!rel.secao(op.titulo || 'Problemas e avisos', op.abertos ? `${todos.length} ${todos.length === 1 ? 'aberto' : 'abertos'}` : `${Math.min(todos.length, max)} de ${todos.length} · ${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}`)) return;
    const ps = todos.slice(0, max);
    const fotos = await Promise.all(ps.map((p) => (p.foto ? miniatura(p.foto, 160) : null)));
    ps.forEach((p, k) => {
      const desc = A.ui.descreverProblema(p) + (p.perdaKg > 0 ? ` · perdeu ${kg(p.perdaKg)}` : '');
      const alt = fotos[k] ? 18 : desc.length > 42 ? 11 : 8.5;
      rel.cabe(alt); // pode abrir página nova: a foto vai junto da linha
      const y0 = rel.y;
      rel.linha([
        { t: `${ddmmaa(p.quando)} ${hora(p.quando)}`, w: 0.14, cor: COR.tinta2, tam: 9 },
        { t: desc, w: 0.42, b: true, tam: 9.5, quebra: true },
        { t: p.pessoaNome || '-', w: 0.14, cor: COR.tinta2, tam: 9.5 },
        p.resolvidoEm ? { t: 'RESOLVIDO', w: 0.15, selo: 'verde', al: 'center' } : { t: 'ABERTO', w: 0.15, selo: 'vermelho', al: 'center' },
        { t: '', w: 0.15 },
      ], { alt });
      if (fotos[k]) rel.imagem(fotos[k], rel.L - rel.m - 16, y0 + 0.5, 16, 16);
    });
    if (!ps.length) rel.frase(op.abertos ? 'Nenhum problema aberto.' : 'Nenhum problema registrado.', { cor: COR.verdeEscuro, b: true });
    rel.y += 3;
  }

  // RELATÓRIO COMPLETO: fazenda, data, insumos e estoque, fórmulas, lotes, últimas misturas, chegadas e problemas (com fotos)
  async function completo() {
    const P_ = P();
    const { num, reais, kg, COR } = P_;
    const [jsPDF, png, insumos, formulas, pastos, misturas, entradas, problemas, nomeFazenda, epoca] = await Promise.all([
      P_.carregar(), P_.logo(), A.db.todos('insumos'), A.db.todos('formulas'), A.db.todos('pastos'), A.db.todos('misturas'),
      A.db.todos('entradas'), A.db.todos('problemas'), A.db.config('nomeFazenda'), A.db.config('epocaAtual'),
    ]);
    const agora = Date.now();
    const insPorId = {};
    insumos.forEach((i) => { insPorId[i.id] = i; });
    const forPorId = {};
    formulas.forEach((f) => { forPorId[f.id] = f; });
    const rel = new P_.Relatorio(jsPDF, { paginas: true });
    const hoje = new Date(agora).toISOString();
    rel.cabecalho('Relatório completo', `${nomeFazenda || 'Fazenda'} · ${ddmm(hoje)}/${new Date(agora).getFullYear()} às ${hora(hoje)}`, png);

    const abertos = problemas.filter((p) => !p.resolvidoEm).length;
    rel.numeros([
      { rotulo: 'Insumos', valor: String(insumos.length), detalhe: 'cadastrados' },
      { rotulo: 'Fórmulas', valor: String(formulas.length), detalhe: 'sais cadastrados' },
      { rotulo: 'Lotes', valor: String(pastos.length), detalhe: `${num(pastos.reduce((s, p) => s + (p.cabecas || 0), 0))} cabeças` },
      { rotulo: 'Misturas', valor: String(misturas.length), detalhe: 'registradas no celular' },
      { rotulo: 'Problemas', valor: String(problemas.length), detalhe: `${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}`, destaque: abertos > 0 },
    ]);
    if (epoca) rel.frase(`Época marcada: ${C().EPOCAS[epoca].nome.toLowerCase()}.`, { b: true, cor: COR.tinta });
    rel.y += 2;

    const cab = (cols) => rel.linha(cols.map((c) => Object.assign({}, c, { cor: COR.tinta2, b: true })), { tam: 8, alt: 6 });

    // INSUMOS E ESTOQUE
    if (rel.secao('Insumos e estoque', 'estoque estimado pelo app · dias = no ritmo dos últimos 14 dias')) {
      const colunas = () => cab([{ t: 'Insumo', w: 0.27 }, { t: 'Estoque', w: 0.13, al: 'right' }, { t: 'Em sacos', w: 0.17, al: 'right' }, { t: 'Mínimo', w: 0.11, al: 'right' }, { t: 'R$/kg', w: 0.1, al: 'right' }, { t: 'Situação', w: 0.22, al: 'right' }]);
      colunas();
      C().situacaoEstoque(insumos, misturas, agora).sort((a, b) => a.insumo.nome.localeCompare(b.insumo.nome, 'pt-BR')).forEach((s) => {
        const i = s.insumo;
        const pk = C().precoKg(i);
        const sit = i.estoqueKg <= 0 ? 'ACABOU' : s.dias !== null ? `${s.dias} ${s.dias === 1 ? 'DIA' : 'DIAS'}` : (s.nivel ? 'ABAIXO DO MÍNIMO' : 'SEM CONSUMO');
        rel.linha([
          { t: i.nome, w: 0.27, b: true, quebra: true },
          { t: kg(Math.max(0, i.estoqueKg)), w: 0.13, al: 'right' },
          { t: C().unidade(i).kgPor ? C().qtdTexto(i.estoqueKg, i) : 'a granel', w: 0.17, al: 'right', cor: COR.tinta2, tam: 9.5 },
          { t: i.estoqueMinimoKg > 0 ? kg(i.estoqueMinimoKg) : '-', w: 0.11, al: 'right', cor: COR.tinta2 },
          { t: pk !== null ? reais(pk, 2) : null, w: 0.1, al: 'right' },
          { t: sit, w: 0.22, al: 'right', selo: s.nivel || (s.dias !== null ? 'verde' : 'sem') },
        ], { alt: i.nome.length > 22 ? 11 : 8.5 });
      });
      if (!insumos.length) rel.frase('Nenhum insumo cadastrado.');
      rel.y += 3;
    }

    // FÓRMULAS: receita da batida base, % de cada insumo e custo por kg
    if (rel.secao('Fórmulas', 'receita da batida base · custo pelos preços de hoje')) {
      formulas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach((f) => {
        const base = C().baseKg(f);
        const c = C().custoItens(f.itens, insPorId);
        const tipo = C().TIPOS[f.tipo] ? C().TIPOS[f.tipo].nome.toLowerCase() : 'sem tipo';
        const ep = C().EPOCAS[C().epocaDaFormula(f)].nome.toLowerCase();
        rel.cabe(8.5 + 6 * Math.min(f.itens.length, 3)); // nome da fórmula junto das primeiras linhas
        rel.linha([
          { t: f.nome, w: 0.4, b: true },
          { t: `${tipo} · ${ep}`, w: 0.24, cor: COR.tinta2, tam: 9.5 },
          { t: `batida ${C().tamanhos(f).map((t) => num(t)).join(' / ')} kg`, w: 0.2, al: 'right', tam: 9.5 },
          { t: c.porKg !== null ? reais(c.porKg, 2) + '/kg' : null, w: 0.16, al: 'right', b: true },
        ], { fundo: COR.creme });
        f.itens.forEach((it) => {
          const ins = insPorId[it.insumoId];
          rel.linha([
            { t: '', w: 0.04 },
            { t: ins ? ins.nome : '(insumo apagado)', w: 0.46 },
            { t: kg(it.kg), w: 0.2, al: 'right' },
            { t: base > 0 ? num((it.kg / base) * 100) + '%' : '-', w: 0.15, al: 'right', cor: COR.tinta2 },
            { t: ins && ins.maxPct > 0 ? `máx. ${num(ins.maxPct)}%` : '', w: 0.15, al: 'right', cor: COR.tinta2, tam: 8.5 },
          ], { tam: 9.5, alt: 6 });
        });
        rel.y += 1.5;
      });
      if (!formulas.length) rel.frase('Nenhuma fórmula cadastrada.');
      rel.y += 2;
    }

    // LOTES
    if (rel.secao('Lotes', 'sal de cada época · meta do técnico águas / seca (g/cabeça/dia)')) {
      cab([{ t: 'Lote', w: 0.3 }, { t: 'Cabeças', w: 0.09, al: 'right' }, { t: '', w: 0.02 }, { t: 'Sal das águas', w: 0.23 }, { t: 'Sal da seca', w: 0.23 }, { t: 'Meta (g)', w: 0.13, al: 'right' }]);
      const nomeSal = (id) => (id ? (forPorId[id] ? forPorId[id].nome : '(apagada)') : '-');
      pastos.slice().sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0)).forEach((p) => {
        const meta = (g) => (g > 0 ? num(g) : '-');
        rel.linha([
          { t: `${p.numero ?? ''} · ${p.nome}`, w: 0.3, b: true },
          { t: num(p.cabecas || 0), w: 0.09, al: 'right' }, { t: '', w: 0.02 },
          { t: nomeSal(p.formulaAguasId), w: 0.23, tam: 9.5 },
          { t: nomeSal(p.formulaSecaId), w: 0.23, tam: 9.5 },
          { t: `${meta(p.metaAguasG)} / ${meta(p.metaSecaG)}`, w: 0.13, al: 'right' },
        ]);
      });
      if (!pastos.length) rel.frase('Nenhum lote cadastrado.');
      rel.y += 3;
    }

    await secaoMisturas(rel, misturas, insPorId, { max: MAX_LINHAS, titulo: 'Últimas misturas' });
    secaoChegadas(rel, entradas, { max: MAX_LINHAS });
    await secaoProblemas(rel, problemas, { max: MAX_LINHAS });

    rel.rodapeTodas(`Gerado pelo Cocho em ${P_.dataHora(agora)}. PDF só para ler: a cópia de segurança é o arquivo .cocho. "sem dado" = falta preço ou informação.`);
    const d = new Date(agora);
    const data = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    return { blob: rel.blob(), nome: P_.nomeArquivo('Relatório completo', data, nomeFazenda) };
  }

  // GASTO POR SEMANA: uma linha por semana desde a primeira mistura + total geral (entra o resultado de historico())
  async function historico(h) {
    const P_ = P();
    const { num, reais, kg, COR } = P_;
    const [jsPDF, png] = await Promise.all([P_.carregar(), P_.logo()]);
    const rel = new P_.Relatorio(jsPDF, { paginas: true });
    const tt = h.total;
    const desde = tt.desde ? `${ddmm(new Date(tt.desde).toISOString())}/${new Date(tt.desde).getFullYear()}` : '-';
    const agora = Date.now();
    rel.cabecalho('Gasto por semana', `${h.nomeFazenda || 'Fazenda'} · desde ${desde}`, png);
    rel.numeros([
      { rotulo: 'Gasto total', valor: reais(tt.gasto, 0) + (tt.gastoIncompleto ? ' +' : ''), detalhe: tt.gastoEstimado ? 'parte estimada' : 'pelo preço pago', destaque: true },
      { rotulo: 'Média por semana', valor: reais(tt.semanas ? tt.gasto / tt.semanas : 0, 0), detalhe: `${tt.semanas} ${tt.semanas === 1 ? 'semana' : 'semanas'}`, destaque: true },
      { rotulo: 'Sal feito', valor: kg(tt.kgFeitos), detalhe: `${tt.misturas} misturas` },
      { rotulo: 'Perdas', valor: reais(tt.perdasReais, 0) + (tt.perdasIncompleto ? ' +' : ''), detalhe: `${tt.problemas} ${tt.problemas === 1 ? 'problema' : 'problemas'}` },
    ]);
    if (rel.secao('Semana a semana', 'segunda a domingo · a mais nova primeiro')) {
      const colunas = [
        { t: 'Semana', w: 0.2 }, { t: 'Misturas', w: 0.1, al: 'right' }, { t: 'Sal feito', w: 0.13, al: 'right' },
        { t: 'Gasto', w: 0.15, al: 'right' }, { t: '', w: 0.13, al: 'center' }, { t: 'Perdas', w: 0.13, al: 'right' }, { t: 'R$/cab/dia', w: 0.16, al: 'right' },
      ];
      rel.linha(colunas.map((c) => Object.assign({}, c, { cor: COR.tinta2, b: true })), { tam: 8, alt: 6 });
      h.semanas.forEach((s) => {
        rel.linha([
          { t: `${s.rotulo}/${String(s.ano).slice(2)}${s.emAndamento ? ' *' : ''}`, w: 0.2, b: true, tam: 10 },
          { t: String(s.misturas), w: 0.1, al: 'right' },
          { t: kg(s.kgFeitos), w: 0.13, al: 'right' },
          { t: reais(s.gasto, 0), w: 0.15, al: 'right', b: true },
          s.gastoEstimado ? { t: 'ESTIMADO', w: 0.13, selo: 'laranja', al: 'center' } : { t: '', w: 0.13 },
          { t: s.perdasReais === null ? null : reais(s.perdasReais, 0), w: 0.13, al: 'right', cor: COR.tinta2 },
          { t: s.custoCabDia === null ? null : reais(s.custoCabDia, 2), w: 0.16, al: 'right' },
        ]);
      });
      rel.linha([
        { t: 'Total', w: 0.2, b: true }, { t: String(tt.misturas), w: 0.1, al: 'right', b: true }, { t: kg(tt.kgFeitos), w: 0.13, al: 'right', b: true },
        { t: reais(tt.gasto, 0) + (tt.gastoIncompleto ? ' +' : ''), w: 0.15, al: 'right', b: true }, { t: '', w: 0.13 },
        { t: reais(tt.perdasReais, 0), w: 0.13, al: 'right', b: true },
        { t: tt.custoCabDia === null ? null : reais(tt.custoCabDia, 2), w: 0.16, al: 'right', b: true },
      ], { traco: false, fundo: COR.creme });
      rel.y += 2;
      if (h.semanas.some((s) => s.emAndamento)) rel.frase('* semana em andamento (até hoje).');
      rel.frase('Gasto = insumos colocados nas misturas, pelo custo do dia de cada mistura (média das compras no galpão). ESTIMADO = alguma compra sem preço pago: usou o preço cadastrado.');
      rel.frase('R$/cab/dia do total = média das semanas. "+" ou "sem dado" = falta preço de algum insumo.');
    }
    rel.rodapeTodas(`Gerado pelo Cocho em ${P_.dataHora(agora)}.`);
    const d = new Date(agora);
    const data = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    return { blob: rel.blob(), nome: P_.nomeArquivo('Gasto por semana', data, h.nomeFazenda) };
  }

  const dataArquivo = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; };
  const dm = (ms) => ddmm(new Date(ms).toISOString());

  // PAINEL (últimos 7 dias) inteiro ou só uma parte. d = App.calc.painel(...).
  // op = { parte: 'painel' | 'consumo' | 'compras' | 'problemas', nomeFazenda, epoca }
  // Devolve { blob, nome, mensagem } (mensagem curta para o WhatsApp).
  const PARTES = {
    painel: { titulo: 'Painel', arquivo: 'Painel', secoes: ['producao', 'custo', 'prevreal', 'estoque', 'consumo', 'compras', 'problemas'] },
    consumo: { titulo: 'Consumo por cabeça', arquivo: 'Consumo', secoes: ['consumo'] },
    compras: { titulo: 'Lista de compras', arquivo: 'Lista de compras', secoes: ['compras'] },
    problemas: { titulo: 'Problemas abertos', arquivo: 'Problemas', secoes: ['problemas'] },
  };
  async function painel(d, op) {
    const P_ = P();
    const { num, reais, kg, COR } = P_;
    const parte = PARTES[op.parte] || PARTES.painel;
    const tem = (s) => parte.secoes.includes(s);
    const [jsPDF, png] = await Promise.all([P_.carregar(), P_.logo()]);
    const rel = new P_.Relatorio(jsPDF, { paginas: true });
    const periodo = `${dm(d.inicio)} a ${dm(d.agora)}`;
    const ep = op.epoca ? C().EPOCAS[op.epoca] : null;
    const fazenda = op.nomeFazenda || '';
    const so = op.parte === 'compras' || op.parte === 'problemas';
    rel.cabecalho(parte.titulo, `${fazenda || 'Fazenda'} · ${so ? dm(d.agora) + '/' + new Date(d.agora).getFullYear() : 'últimos 7 dias: ' + periodo}${ep && !so ? ' · época ' + ep.nome.toLowerCase() : ''}`, png);
    const cab = (cols) => cabecalhoTabela(rel, cols);
    const qtd = (kgV, ins) => (C().unidade(ins).kgPor ? C().qtdTexto(kgV, ins) : kg(kgV));

    if (tem('producao')) {
      const p = d.producao;
      rel.numeros([
        { rotulo: 'Misturas', valor: String(p.n), detalhe: `antes: ${p.anterior.n}`, destaque: true },
        { rotulo: 'Sal feito', valor: kg(p.kg), detalhe: `antes: ${kg(p.anterior.kg)}`, destaque: true },
        { rotulo: 'Insumos usados', valor: d.custo.semana === null ? null : reais(d.custo.semana, 0), detalhe: 'preços de hoje' },
        { rotulo: 'Problemas abertos', valor: String(d.problemasAbertos.length), detalhe: d.problemasAbertos.length ? 'veja no fim' : 'nenhum' },
      ]);
      if (rel.secao('Produção por sal', 'últimos 7 dias')) {
        p.porFormula.forEach((f) => rel.linha([{ t: f.nome, w: 0.6, b: true }, { t: `${f.n}×`, w: 0.15, al: 'right' }, { t: kg(f.kg), w: 0.25, al: 'right' }]));
        if (!p.porFormula.length) rel.frase('Nenhuma mistura nesses 7 dias.');
        rel.y += 3;
      }
    }
    if (tem('custo') && rel.secao('Custo das fórmulas', 'só insumos, preços de hoje · comparação com o sal pronto')) {
      cab([{ t: 'Fórmula', w: 0.3 }, { t: 'Batida', w: 0.2, al: 'right' }, { t: 'Fabricado', w: 0.15, al: 'right' }, { t: 'Pronto', w: 0.15, al: 'right' }, { t: 'No mês (30 dias)', w: 0.2, al: 'right' }]);
      d.custo.formulas.forEach((x) => rel.linha([
        { t: x.formula.nome, w: 0.3, b: true },
        { t: x.porKg === null ? null : `${kg(x.tamanhoKg)}: ${reais(x.batida, 0)}`, w: 0.2, al: 'right', tam: 9.5 },
        { t: x.porKg === null ? null : reais(x.porKg, 2) + '/kg', w: 0.15, al: 'right', b: true },
        { t: x.prontoKg === null ? '-' : reais(x.prontoKg, 2) + '/kg', w: 0.15, al: 'right', cor: COR.tinta2 },
        x.economiaMes === null || x.economiaMes === undefined ? { t: '-', w: 0.2, al: 'right', cor: COR.tinta2 }
          : { t: `${x.economiaMes >= 0 ? 'economia' : 'a mais'} ${reais(Math.abs(x.economiaMes), 0)}`, w: 0.2, al: 'right', cor: x.economiaMes >= 0 ? COR.verdeEscuro : COR.vermelhoTexto, tam: 9.5 },
      ]));
      if (!d.custo.formulas.length) rel.frase('Nenhuma mistura nos últimos 30 dias.');
      rel.y += 3;
    }
    if (tem('prevreal') && rel.secao('Previsto x real', 'previsto = misturas · real = depois da contagem do estoque')) {
      cab([{ t: 'Insumo', w: 0.32 }, { t: 'Previsto', w: 0.2, al: 'right' }, { t: 'Real', w: 0.18, al: 'right' }, { t: 'Resultado', w: 0.3, al: 'right' }]);
      d.previstoReal.forEach((x) => {
        const ins = x.insumo;
        const res = x.nivel === 'sem' ? ['SEM CONTAGEM', 'sem'] : x.nivel === 'verde' ? ['BATEU', 'verde']
          : [`${x.difKg > 0 ? 'SUMIU' : 'SOBROU'} ${C().qtdTexto(Math.abs(x.difKg), ins).toUpperCase()}`, x.nivel];
        rel.linha([
          { t: ins.nome, w: 0.32, b: true }, { t: kg(x.previstoKg), w: 0.2, al: 'right' },
          { t: x.contado ? kg(x.realKg) : '-', w: 0.18, al: 'right' }, { t: res[0], w: 0.3, selo: res[1], al: 'right' },
        ]);
      });
      if (!d.previstoReal.length) rel.frase('Nenhuma mistura nem contagem nesses 7 dias.');
      rel.y += 3;
    }
    if (tem('estoque') && rel.secao('Estoque em dias', 'consumo médio dos últimos 14 dias')) {
      cab([{ t: 'Insumo', w: 0.32 }, { t: 'Tem', w: 0.24, al: 'right' }, { t: 'Mínimo', w: 0.18, al: 'right' }, { t: 'Situação', w: 0.26, al: 'right' }]);
      d.estoque.forEach(({ insumo: ins, dias, nivel }) => {
        const texto = dias === null ? (nivel ? (ins.estoqueKg <= 0 ? 'ACABOU' : 'ABAIXO DO MÍNIMO') : 'SEM USO RECENTE') : (dias === 0 ? 'ACABA HOJE' : `${dias} ${dias === 1 ? 'DIA' : 'DIAS'}`);
        rel.linha([
          { t: ins.nome, w: 0.32, b: true }, { t: qtd(Math.max(0, ins.estoqueKg), ins), w: 0.24, al: 'right', tam: 10 },
          { t: ins.estoqueMinimoKg ? qtd(ins.estoqueMinimoKg, ins) : '-', w: 0.18, al: 'right', cor: COR.tinta2, tam: 10 },
          { t: texto, w: 0.26, selo: nivel || (dias === null ? 'sem' : 'verde'), al: 'right' },
        ]);
      });
      rel.y += 3;
    }
    if (tem('consumo') && rel.secao('Consumo por cabeça por dia', `sal mandado ao pasto ÷ cabeças ÷ ${d.dias} dias · meta do técnico${ep ? ' (' + ep.nome.toLowerCase() + ')' : ''}`)) {
      cab([{ t: 'Lote', w: 0.27 }, { t: 'Cabeças', w: 0.1, al: 'right' }, { t: 'Enviado', w: 0.13, al: 'right' }, { t: 'g/cab/dia', w: 0.12, al: 'right' }, { t: 'Meta', w: 0.09, al: 'right' }, { t: 'Situação', w: 0.15, al: 'center' }, { t: 'R$/cab/dia', w: 0.14, al: 'right' }]);
      const NV = { dentro: ['DENTRO', 'verde'], acima: ['ACIMA', 'laranja'], abaixo: ['ABAIXO', 'laranja'] };
      d.consumoPastos.forEach((x) => {
        const p = x.pasto;
        const nv = NV[x.nivelMeta];
        rel.linha([
          { t: `${p.numero ?? ''} · ${p.nome}`, w: 0.27, b: true },
          { t: num(p.cabecas || 0), w: 0.1, al: 'right' },
          { t: kg(x.kg), w: 0.13, al: 'right' },
          { t: x.gramas !== null ? num(x.gramas) + ' g' : (p.cabecas > 0 ? '-' : 'sem cabeças'), w: 0.12, al: 'right', b: true },
          { t: x.meta ? num(x.meta) + ' g' : '-', w: 0.09, al: 'right', cor: COR.tinta2 },
          nv ? { t: nv[0], w: 0.15, selo: nv[1], al: 'center' } : { t: '', w: 0.15 },
          { t: x.custoCabDia !== null ? reais(x.custoCabDia, 3) : (x.semPreco ? null : '-'), w: 0.14, al: 'right' },
        ]);
      });
      if (!d.consumoPastos.length) rel.frase('Nenhum pasto cadastrado.');
      if (d.kgDeposito) rel.frase(`Foram para o depósito: ${kg(d.kgDeposito)} (não entram na conta).`);
      rel.y += 3;
    }
    if (tem('compras') && rel.secao('Lista de compras sugerida', `para ${C().DIAS_COMPRA} dias de produção + estoque mínimo − o que já tem`)) {
      cab([{ t: 'Insumo', w: 0.36 }, { t: 'Comprar', w: 0.26, al: 'right' }, { t: 'Em kg', w: 0.18, al: 'right' }, { t: 'Valor', w: 0.2, al: 'right' }]);
      d.compras.forEach((c) => rel.linha([
        { t: c.insumo.nome, w: 0.36, b: true }, { t: qtd(c.kg, c.insumo), w: 0.26, al: 'right', b: true },
        { t: kg(c.kg), w: 0.18, al: 'right', cor: COR.tinta2 }, { t: c.custo === null ? null : reais(c.custo, 0), w: 0.2, al: 'right' },
      ]));
      if (d.compras.length) {
        const total = d.compras.reduce((s, c) => s + (c.custo || 0), 0);
        const sem = d.compras.some((c) => c.custo === null);
        rel.linha([{ t: 'Total estimado (preços de hoje)', w: 0.7, b: true }, { t: reais(total, 0) + (sem ? ' + sem dado' : ''), w: 0.3, al: 'right', b: true }], { traco: false, fundo: COR.creme });
      } else rel.frase('Nada para comprar.', { cor: COR.verdeEscuro, b: true });
      rel.y += 3;
    }
    if (tem('problemas')) await secaoProblemas(rel, d.problemasAbertos, { abertos: true, titulo: 'Problemas abertos' });

    rel.rodapeTodas(`Gerado pelo Cocho em ${P_.dataHora(d.agora)}. Custos pelos preços de hoje do cadastro. "sem dado" = falta preço ou informação.`);
    const rotulo = so ? dataArquivo(d.agora) : `${dm(d.inicio)} a ${dm(d.agora)}`.replace(/\//g, '-');
    return { blob: rel.blob(), nome: P_.nomeArquivo(parte.arquivo, rotulo, fazenda), mensagem: mensagemPainel(d, op.parte || 'painel', fazenda) };
  }

  // Mensagem curta do painel (ou da parte) para o WhatsApp
  function mensagemPainel(d, parte, fazenda) {
    const { num, kg } = P();
    const R = (v, c) => (v === null || v === undefined ? 'sem dado' : 'R$ ' + num(v, c || 0));
    const topo = (t) => `*Cocho${fazenda ? ' - ' + fazenda : ''}* - ${t}`;
    if (parte === 'compras') {
      const l = d.compras.slice(0, 8).map((c) => `- ${c.insumo.nome}: ${C().unidade(c.insumo).kgPor ? C().qtdTexto(c.kg, c.insumo) : kg(c.kg)}`);
      const total = d.compras.reduce((s, c) => s + (c.custo || 0), 0);
      return [topo(`Lista de compras ${dm(d.agora)}`)].concat(l.length ? l : ['Nada para comprar.'], d.compras.length > 8 ? ['...'] : [], d.compras.length ? [`Total estimado: ${R(total)}`] : []).join('\n');
    }
    if (parte === 'problemas') {
      const ps = d.problemasAbertos;
      return [topo(`Problemas abertos: ${ps.length}`)].concat(ps.slice(0, 5).map((p) => `- ${A.ui.descreverProblema(p)} (${ddmm(p.quando)}, ${p.pessoaNome || '-'})`), ps.length > 5 ? ['...'] : []).join('\n');
    }
    if (parte === 'consumo') {
      const l = d.consumoPastos.filter((x) => x.gramas !== null).slice(0, 6).map((x) => `- ${x.pasto.nome}: ${num(x.gramas)} g${x.meta ? ' (meta ' + num(x.meta) + ')' : ''}`);
      return [topo(`Consumo por cabeça/dia ${dm(d.inicio)} a ${dm(d.agora)}`)].concat(l.length ? l : ['Nenhum sal mandado ao pasto.']).join('\n');
    }
    const acabando = d.estoque.filter((e) => e.nivel === 'vermelho').map((e) => e.insumo.nome);
    const linhas = [
      topo(`Painel ${dm(d.inicio)} a ${dm(d.agora)}`),
      `Produção: ${d.producao.n} misturas · ${kg(d.producao.kg)} de sal`,
      `Insumos usados: ${R(d.custo.semana)}`,
      `Problemas abertos: ${d.problemasAbertos.length}`,
    ];
    if (acabando.length) linhas.push(`Acabando: ${acabando.slice(0, 3).join(', ')}`);
    return linhas.join('\n');
  }

  // REGISTROS: tudo o que está guardado (misturas com custo, chegadas com preço pago, problemas, correções de estoque)
  async function registros() {
    const P_ = P();
    const { kg, COR } = P_;
    const [jsPDF, png, insumos, misturas, entradas, problemas, contagens, nomeFazenda] = await Promise.all([
      P_.carregar(), P_.logo(), A.db.todos('insumos'), A.db.todos('misturas'), A.db.todos('entradas'),
      A.db.todos('problemas'), A.db.todos('contagens'), A.db.config('nomeFazenda'),
    ]);
    const agora = Date.now();
    const insPorId = {};
    insumos.forEach((i) => { insPorId[i.id] = i; });
    const rel = new P_.Relatorio(jsPDF, { paginas: true });
    rel.cabecalho('Registros', `${nomeFazenda || 'Fazenda'} · ${dm(agora)}/${new Date(agora).getFullYear()} · tudo o que está guardado no celular`, png);
    rel.numeros([
      { rotulo: 'Misturas', valor: String(misturas.length), detalhe: kg(misturas.reduce((s, m) => s + (m.totalKg || 0), 0)) + ' de sal', destaque: true },
      { rotulo: 'Chegadas', valor: String(entradas.length), detalhe: `${entradas.filter((e) => !(e.precoKg > 0)).length} sem preço pago` },
      { rotulo: 'Problemas', valor: String(problemas.length), detalhe: `${problemas.filter((p) => !p.resolvidoEm).length} abertos` },
      { rotulo: 'Contagens', valor: String(contagens.length), detalhe: 'correções de estoque' },
    ]);
    secaoMisturas(rel, misturas, insPorId, { titulo: 'Misturas' });
    secaoChegadas(rel, entradas, {});
    await secaoProblemas(rel, problemas, {});
    const cs = recentes(contagens, 'quando');
    if (rel.secao('Contagens e correções de estoque', `${cs.length}`)) {
      cabecalhoTabela(rel, [{ t: 'Data', w: 0.16 }, { t: 'Insumo', w: 0.34 }, { t: 'Antes', w: 0.15, al: 'right' }, { t: 'Contado', w: 0.15, al: 'right' }, { t: 'Diferença', w: 0.2, al: 'right' }]);
      const TIPO = { inicial: ' (cadastro)', correcao: ' (correção)' };
      cs.forEach((c) => {
        const dif = Math.round((c.depoisKg - c.antesKg) * 10) / 10;
        rel.linha([
          { t: `${ddmmaa(c.quando)} ${hora(c.quando)}`, w: 0.16, cor: COR.tinta2, tam: 9 },
          { t: c.insumoNome + (TIPO[c.tipo] || ''), w: 0.34, b: true, tam: 10 },
          { t: kg(c.antesKg), w: 0.15, al: 'right' }, { t: kg(c.depoisKg), w: 0.15, al: 'right' },
          Math.abs(dif) < 0.05 ? { t: 'BATEU', w: 0.2, selo: 'verde', al: 'right' } : { t: `${dif > 0 ? '+' : '-'}${kg(Math.abs(dif))}`, w: 0.2, al: 'right', b: true, cor: dif < 0 ? COR.vermelhoTexto : COR.tinta },
        ]);
      });
      if (!cs.length) rel.frase('Nenhuma contagem registrada.');
    }
    rel.rodapeTodas(`Gerado pelo Cocho em ${P_.dataHora(agora)}. PDF só para ler: a cópia de segurança é o arquivo .cocho.`);
    const mensagem = [`*Cocho${nomeFazenda ? ' - ' + nomeFazenda : ''}* - Registros até ${dm(agora)}`,
      `${misturas.length} misturas · ${entradas.length} chegadas · ${problemas.length} problemas`].join('\n');
    return { blob: rel.blob(), nome: P_.nomeArquivo('Registros', dataArquivo(agora), nomeFazenda), mensagem };
  }

  A.pdfRelatorios = { completo, historico, painel, registros, mensagemPainel, miniatura };
})();
