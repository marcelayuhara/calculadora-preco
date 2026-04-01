import { useState } from "react";

const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtN = (v, dec = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v || 0);

// ─── UI Primitives ────────────────────────────────────────────────────────────

const Label = ({ children }) => (
  <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", color: "#444", fontFamily: "'DM Sans', sans-serif" }}>{children}</p>
);
const Hint = ({ children }) => (
  <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#999", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{children}</p>
);

const NumberInput = ({ label, hint, value, onChange, prefix = "R$", placeholder = "0" }) => (
  <div style={{ marginBottom: "18px" }}>
    <Label>{label}</Label>
    {hint && <Hint>{hint}</Hint>}
    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e0e0e0", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
      <span style={{ padding: "10px 12px", background: "#f5f5f5", color: "#888", fontSize: "12px", borderRight: "1.5px solid #e0e0e0", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{prefix}</span>
      <input type="number" min={0} value={value || ""} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} placeholder={placeholder}
        style={{ flex: 1, border: "none", outline: "none", padding: "10px 14px", fontSize: "16px", fontFamily: "'DM Mono', monospace", color: "#1a1a1a", background: "transparent", width: "100%", minWidth: 0 }} />
    </div>
  </div>
);

const SliderInput = ({ label, hint, value, onChange, min, max, unit = "%" }) => (
  <div style={{ marginBottom: "18px" }}>
    <Label>{label}</Label>
    {hint && <Hint>{hint}</Hint>}
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: "#2d7a4a" }} />
      <span style={{ fontSize: "16px", fontWeight: "700", color: "#2d7a4a", fontFamily: "'DM Mono', monospace", minWidth: "48px", textAlign: "right" }}>{value}{unit}</span>
    </div>
  </div>
);

const Select = ({ label, hint, value, onChange, options }) => (
  <div style={{ marginBottom: "18px" }}>
    <Label>{label}</Label>
    {hint && <Hint>{hint}</Hint>}
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", border: "1.5px solid #e0e0e0", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a", background: "#fff", outline: "none", cursor: "pointer" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Card = ({ label, value, sub, highlight, warn }) => {
  const bg = highlight ? "#1a3a2a" : warn ? "#fff8f0" : "#f7f7f5";
  const border = highlight ? "none" : warn ? "1px solid #f0d9b5" : "1px solid #ebebeb";
  const labelColor = highlight ? "#7ecba0" : warn ? "#c0702a" : "#aaa";
  const valueColor = highlight ? "#fff" : warn ? "#c0702a" : "#1a1a1a";
  const subColor = highlight ? "#9bd4b5" : warn ? "#e0975a" : "#aaa";
  return (
    <div style={{ background: bg, borderRadius: "10px", padding: "14px 18px", marginBottom: "10px", border }}>
      <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor, fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: highlight ? "26px" : "20px", fontWeight: "700", color: valueColor, fontFamily: "'DM Mono', monospace" }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: "12px", color: subColor, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{sub}</p>}
    </div>
  );
};

const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "20px 0 16px" }}>
    <div style={{ flex: 1, height: "1px", background: "#ebebeb" }} />
    {label && <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", color: "#ccc", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>}
    <div style={{ flex: 1, height: "1px", background: "#ebebeb" }} />
  </div>
);

// ─── Lógica de precificação ───────────────────────────────────────────────────
/*
  LÓGICA CORRETA:
  1. Custos fixos são da empresa, não de um produto.
     São diluídos entre TODOS os clientes ativos.
  2. Custo variável é por cliente (materiais, plataforma etc.)
  3. Preço mínimo por cliente = (custo fixo ÷ total clientes) + custo variável
     ajustado pelo imposto: precoMin = custoPorCliente / (1 - imposto%)
  4. Preço com margem = custoPorCliente / (1 - imposto% - margem%)
  5. Preço recomendado = preço com margem × multiplicador de transformação
  6. Mercado: referência de posicionamento (+15%), não base de cálculo.
     Preço final = max(calculado, mercado + 15%) — nunca abaixo do mínimo.
*/

function calcular({ custoFixo, custoVariavelPorCliente, retirada, totalClientes, margemPct, impostoPct, transformacao, precoConcorrente }) {
  if (totalClientes <= 0) return null;

  const custoFixoTotal = custoFixo + retirada;
  const custoFixoPorCliente = custoFixoTotal / totalClientes;
  const custoPorCliente = custoFixoPorCliente + custoVariavelPorCliente;

  // Mínimo: cobre custo + imposto (sem margem)
  const precoMinimo = custoPorCliente / (1 - impostoPct);

  // Base: cobre custo + imposto + margem
  const precoBase = custoPorCliente / (1 - impostoPct - margemPct);

  // Multiplicador por transformação
  const mult = { baixa: 1.0, media: 1.25, alta: 1.5, premium: 2.0 }[transformacao] || 1;
  const precoCalculado = precoBase * mult;

  // Referência de mercado
  const mercadoAlvo = precoConcorrente > 0 ? precoConcorrente * 1.15 : 0;

  // Recomendado: o maior entre o calculado e o alvo de mercado, nunca abaixo do mínimo
  const precoRecomendado = Math.max(precoCalculado, mercadoAlvo, precoMinimo);

  // Stretch: 40% acima do recomendado
  const precoStretch = precoRecomendado * 1.4;

  // Projeções
  const faturamentoMinimo = precoMinimo * totalClientes;
  const faturamentoRecomendado = precoRecomendado * totalClientes;

  // Margem real com preço recomendado
  const receitaLiquida = precoRecomendado * (1 - impostoPct);
  const margemReal = ((receitaLiquida - custoPorCliente) / precoRecomendado) * 100;

  // Ponto de equilíbrio: quantos clientes cobrem os custos fixos
  const contribuicao = precoMinimo * (1 - impostoPct) - custoVariavelPorCliente;
  const pontoEquilibrio = contribuicao > 0 ? Math.ceil(custoFixoTotal / contribuicao) : null;

  return {
    precoMinimo, precoCalculado, precoRecomendado, precoStretch,
    faturamentoMinimo, faturamentoRecomendado,
    margemReal, custoPorCliente, custoFixoPorCliente, custoFixoTotal,
    pontoEquilibrio, mercadoAlvo,
    alertas: {
      abaixoMercado: precoConcorrente > 0 && precoCalculado < precoConcorrente * 0.85,
      muitoAcimaMercado: precoConcorrente > 0 && precoRecomendado > precoConcorrente * 2.5,
      margemBaixa: margemReal < 30,
      poucoClientes: pontoEquilibrio !== null && totalClientes < pontoEquilibrio,
    },
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

const STEPS = ["Custos", "Clientes", "Posicionamento"];

export default function Calculadora() {
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const [custoFixo, setCustoFixo] = useState(0);
  const [retirada, setRetirada] = useState(0);
  const [impostos, setImpostos] = useState(15);

  const [totalClientes, setTotalClientes] = useState(0);
  const [custoVarPorCliente, setCustoVarPorCliente] = useState(0);
  const [margem, setMargem] = useState(40);

  const [transformacao, setTransformacao] = useState("alta");
  const [precoConcorrente, setPrecoConcorrente] = useState(0);

  const custoFixoTotal = custoFixo + retirada;

  const resultado = calcular({
    custoFixo, custoVariavelPorCliente: custoVarPorCliente, retirada,
    totalClientes, margemPct: margem / 100, impostoPct: impostos / 100,
    transformacao, precoConcorrente,
  });

  const getPerfil = (preco) => {
    if (!preco || preco < 1000) return { label: "Especialista Invisível", desc: "Você está cobrando pelo tempo, não pela transformação. Esse preço não sustenta um negócio saudável.", cor: "#c0392b" };
    if (preco < 4000) return { label: "Em Transição", desc: "Preço viável, mas com espaço para crescer. O próximo passo é posicionamento e prova social.", cor: "#e67e22" };
    return { label: "Oferta Essencial", desc: "Seu preço reflete transformação, não horas. Agora o foco é posicionamento e consistência.", cor: "#27ae60" };
  };

  const p = resultado ? getPerfil(resultado.precoRecomendado) : null;
  const canNext0 = custoFixoTotal > 0;
  const canNext1 = totalClientes > 0;
  const canAdvance = step === 0 ? canNext0 : step === 1 ? canNext1 : true;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f3ef", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 48px" }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: "520px", marginBottom: "28px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#1a3a2a", borderRadius: "100px", padding: "5px 14px", marginBottom: "18px" }}>
          <span style={{ width: "6px", height: "6px", background: "#7ecba0", borderRadius: "50%", display: "inline-block" }} />
          <span style={{ color: "#9bd4b5", fontSize: "10px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>ML Academy · Método Essencial®</span>
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(22px, 5vw, 30px)", fontWeight: "700", color: "#1a1a1a", lineHeight: 1.2 }}>
          Calculadora de<br /><span style={{ color: "#2d7a4a" }}>Precificação Essencial</span>
        </h1>
        <p style={{ color: "#888", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
          Descubra o preço real que seu negócio precisa cobrar — baseado nos seus custos, clientes e impacto.
        </p>
      </div>

      {/* Progress */}
      {!showResult && (
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", gap: "6px", marginBottom: "20px" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: "3px", borderRadius: "2px", background: i <= step ? "#2d7a4a" : "#ddd", transition: "background 0.3s" }} />
              <p style={{ margin: "5px 0 0", fontSize: "10px", color: i <= step ? "#2d7a4a" : "#ccc", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" }}>{s}</p>
            </div>
          ))}
        </div>
      )}

      {/* Card */}
      <div style={{ width: "100%", maxWidth: "520px", background: "#fff", borderRadius: "16px", padding: "26px 24px", boxShadow: "0 2px 24px rgba(0,0,0,0.07)" }}>

        {/* ── STEP 0: Custos ── */}
        {step === 0 && !showResult && (
          <>
            <h2 style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "700", color: "#1a1a1a" }}>Seus custos mensais</h2>
            <p style={{ margin: "0 0 22px", fontSize: "13px", color: "#aaa" }}>A base que ninguém pode ignorar na hora de precificar.</p>

            <NumberInput label="Custos fixos mensais do negócio"
              hint="Ferramentas, equipe, contabilidade, aluguel, assinaturas…"
              value={custoFixo} onChange={setCustoFixo} />
            <NumberInput label="Sua retirada mensal desejada (pro-labore)"
              hint="O que você quer colocar no bolso. É um custo real — não ignore."
              value={retirada} onChange={setRetirada} />
            <SliderInput label="Alíquota de impostos estimada"
              hint="Simples Nacional: 6–15% · Lucro Presumido: ~13–15%"
              value={impostos} onChange={setImpostos} min={5} max={30} />

            {custoFixoTotal > 0 && (
              <div style={{ background: "#f7f7f5", borderRadius: "8px", padding: "12px 16px", marginTop: "4px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#aaa" }}>Total de custos fixos mensais</p>
                <p style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: "700", fontFamily: "'DM Mono', monospace", color: "#1a1a1a" }}>{fmt(custoFixoTotal)}</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#bbb" }}>Esse valor será diluído entre todos os seus clientes ativos — é o que determina o piso do seu preço.</p>
              </div>
            )}
          </>
        )}

        {/* ── STEP 1: Clientes ── */}
        {step === 1 && !showResult && (
          <>
            <h2 style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "700", color: "#1a1a1a" }}>Sua capacidade de atendimento</h2>
            <p style={{ margin: "0 0 22px", fontSize: "13px", color: "#aaa" }}>Custos fixos são da empresa, não de um produto. Precisamos diluí-los corretamente entre todos os clientes.</p>

            <NumberInput label="Total de clientes ativos por mês (atual ou meta)"
              hint="Some todos os clientes que pagam mensalmente — individuais, grupos, alunos de cursos ativos. Eles dividem seus custos fixos entre si."
              value={totalClientes} onChange={setTotalClientes} prefix="clientes" placeholder="Ex: 15" />
            <NumberInput label="Custo variável por cliente"
              hint="O que você gasta especificamente para atender cada cliente: materiais, plataforma extra, suporte adicional. Se não houver, deixe zero."
              value={custoVarPorCliente} onChange={setCustoVarPorCliente} />
            <SliderInput label="Margem de lucro desejada"
              hint="Negócio saudável: mínimo 35%. Abaixo disso qualquer imprevisto coloca a operação em risco."
              value={margem} onChange={setMargem} min={10} max={70} />

            {totalClientes > 0 && custoFixoTotal > 0 && (
              <div style={{ background: "#f0f7f3", borderRadius: "8px", padding: "14px 16px", marginTop: "4px", border: "1px solid #c8e6d4" }}>
                <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#2d7a4a", letterSpacing: "0.05em", textTransform: "uppercase" }}>Custo fixo diluído</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#555", lineHeight: 1.7 }}>
                  {fmt(custoFixoTotal)} ÷ {totalClientes} clientes = <strong style={{ color: "#2d7a4a" }}>{fmt(custoFixoTotal / totalClientes)} por cliente</strong> só de custo fixo
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#888" }}>
                  Custo total por cliente (fixo + variável): <strong>{fmt(custoFixoTotal / totalClientes + custoVarPorCliente)}</strong>
                </p>
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Posicionamento ── */}
        {step === 2 && !showResult && (
          <>
            <h2 style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "700", color: "#1a1a1a" }}>Posicionamento no mercado</h2>
            <p style={{ margin: "0 0 22px", fontSize: "13px", color: "#aaa" }}>Defina o impacto real da sua entrega e onde você quer se posicionar.</p>

            <Select label="Nível de transformação que você entrega"
              hint="Quanto a vida ou negócio da sua cliente muda com o seu trabalho?"
              value={transformacao} onChange={setTransformacao}
              options={[
                { value: "baixa", label: "Pontual — resolve um problema específico (×1.0)" },
                { value: "media", label: "Significativa — muda um resultado importante (×1.25)" },
                { value: "alta", label: "Alta — transforma o negócio ou carreira (×1.5)" },
                { value: "premium", label: "Premium — impacto financeiro ou de vida direto (×2.0)" },
              ]} />

            <Divider label="Referência de mercado" />

            <NumberInput label="Preço médio cobrado pelas suas concorrentes"
              hint="Opcional, mas recomendado. Pesquise especialistas parecidas no mesmo nicho. Usamos isso apenas para verificar seu posicionamento — não é a base do cálculo."
              value={precoConcorrente} onChange={setPrecoConcorrente} />

            {precoConcorrente > 0 && (
              <div style={{ background: "#f0f7f3", borderRadius: "8px", padding: "12px 14px", marginTop: "-6px", border: "1px solid #c8e6d4" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#2d7a4a", lineHeight: 1.6 }}>
                  💡 <strong>Estratégia Essencial:</strong> cobrar ~15% acima da média ({fmt(precoConcorrente * 1.15)}) te posiciona como referência — sem ser inacessível.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── RESULTADO ── */}
        {showResult && resultado && p && (
          <>
            {/* Perfil */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "18px", paddingBottom: "18px", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.cor, flexShrink: 0, marginTop: "4px" }} />
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#ccc" }}>Perfil de precificação atual</p>
                <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: p.cor }}>{p.label}</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#777", lineHeight: 1.6, borderLeft: `2px solid ${p.cor}`, paddingLeft: "10px" }}>{p.desc}</p>
              </div>
            </div>

            {/* Preços */}
            <Card label="Preço mínimo — não negocie abaixo disso" value={fmt(resultado.precoMinimo)}
              sub={`Cobre todos os seus custos + impostos. Abaixo de ${fmt(resultado.precoMinimo)} você trabalha no prejuízo.`} />
            <Card label="Preço recomendado — Método Essencial®" value={fmt(resultado.precoRecomendado)} highlight
              sub={
                resultado.mercadoAlvo > resultado.precoCalculado
                  ? `Ajustado para 15% acima da média de mercado (${fmt(precoConcorrente)})`
                  : `Cobre custos, gera ${margem}% de margem e precifica sua transformação.`
              } />
            <Card label="Preço stretch — com posicionamento forte" value={fmt(resultado.precoStretch)}
              sub="Viável com autoridade consolidada, prova social e demanda consistente." />

            {/* Você vs Mercado */}
            {precoConcorrente > 0 && (
              <>
                <Divider label="Você vs. Mercado" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ background: "#f7f7f5", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "10px", color: "#bbb" }}>Média mercado</p>
                    <p style={{ margin: "3px 0 0", fontSize: "15px", fontWeight: "700", fontFamily: "'DM Mono', monospace", color: "#aaa" }}>{fmt(precoConcorrente)}</p>
                  </div>
                  <span style={{ color: "#ccc", fontSize: "16px", textAlign: "center" }}>→</span>
                  <div style={{ background: "#edf5f0", borderRadius: "8px", padding: "10px 12px", textAlign: "center", border: "1px solid #c8e6d4" }}>
                    <p style={{ margin: 0, fontSize: "10px", color: "#7ecba0" }}>Seu recomendado</p>
                    <p style={{ margin: "3px 0 0", fontSize: "15px", fontWeight: "700", fontFamily: "'DM Mono', monospace", color: "#2d7a4a" }}>{fmt(resultado.precoRecomendado)}</p>
                  </div>
                </div>
                {resultado.alertas.abaixoMercado && (
                  <div style={{ background: "#fff8f0", border: "1px solid #f0d9b5", borderRadius: "8px", padding: "12px 14px", marginBottom: "10px" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#c0702a", lineHeight: 1.6 }}>⚠ Seu preço calculado ficaria abaixo da média de mercado. Isso pode indicar estrutura de custo alta para o número de clientes ativos. Considere aumentar a base de clientes ou revisar custos fixos.</p>
                  </div>
                )}
                {resultado.alertas.muitoAcimaMercado && (
                  <div style={{ background: "#f0f7f3", border: "1px solid #c8e6d4", borderRadius: "8px", padding: "12px 14px", marginBottom: "10px" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#2d7a4a", lineHeight: 1.6 }}>✦ Seu preço está bem acima da média de mercado. Isso é viável — mas exige posicionamento claro, autoridade reconhecida e prova social consistente.</p>
                  </div>
                )}
              </>
            )}

            {/* Projeção */}
            <Divider label="Projeção mensal" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div style={{ background: "#f7f7f5", borderRadius: "8px", padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: "10px", color: "#bbb" }}>Faturamento mínimo</p>
                <p style={{ margin: "3px 0 0", fontSize: "16px", fontWeight: "700", fontFamily: "'DM Mono', monospace", color: "#1a1a1a" }}>{fmt(resultado.faturamentoMinimo)}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#ccc" }}>com {totalClientes} clientes</p>
              </div>
              <div style={{ background: "#edf5f0", borderRadius: "8px", padding: "12px 14px", border: "1px solid #c8e6d4" }}>
                <p style={{ margin: 0, fontSize: "10px", color: "#7ecba0" }}>Faturamento recomendado</p>
                <p style={{ margin: "3px 0 0", fontSize: "16px", fontWeight: "700", fontFamily: "'DM Mono', monospace", color: "#2d7a4a" }}>{fmt(resultado.faturamentoRecomendado)}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#7ecba0" }}>margem real: ~{fmtN(resultado.margemReal, 0)}%</p>
              </div>
            </div>

            {/* Ponto de equilíbrio */}
            {resultado.pontoEquilibrio !== null && (
              <div style={{ background: "#f7f7f5", borderRadius: "8px", padding: "12px 14px", marginBottom: "10px", border: "1px solid #ebebeb" }}>
                <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>Ponto de equilíbrio</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#555", lineHeight: 1.7 }}>
                  Com o preço mínimo, você precisa de <strong style={{ color: "#1a1a1a" }}>{resultado.pontoEquilibrio} cliente{resultado.pontoEquilibrio !== 1 ? "s" : ""}</strong> para cobrir todos os custos fixos.
                  {totalClientes >= resultado.pontoEquilibrio
                    ? <span style={{ color: "#2d7a4a" }}> ✓ Você já está acima disso.</span>
                    : <span style={{ color: "#c0702a" }}> Você tem {totalClientes} — ainda faltam {resultado.pontoEquilibrio - totalClientes}.</span>}
                </p>
              </div>
            )}

            {/* Alerta margem */}
            {resultado.alertas.margemBaixa && (
              <Card label="⚠ Margem abaixo do ideal" value={`${fmtN(resultado.margemReal, 0)}%`}
                sub="Margem abaixo de 30% deixa o negócio vulnerável. Considere reduzir custos fixos, aumentar clientes ativos ou elevar o preço." warn />
            )}

            {/* CTA */}
            <div style={{ marginTop: "22px", background: "#1a3a2a", borderRadius: "12px", padding: "22px 20px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4d8c6a" }}>próximo passo</p>
              <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#c8e6d4", lineHeight: 1.7 }}>
                Todo dia eu publico conteúdo sobre como especialistas estruturam negócios que faturam mais — trabalhando menos horas e com mais margem.
              </p>
              <a
                href="https://instagram.com/marcelalamastra"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: "#fff", color: "#1a3a2a",
                  padding: "12px 22px", borderRadius: "8px",
                  fontSize: "14px", fontWeight: "700",
                  textDecoration: "none", fontFamily: "'DM Sans', sans-serif",
                  transition: "opacity 0.2s"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
                </svg>
                Seguir @marcelalamastra
              </a>
            </div>

            <button onClick={() => { setShowResult(false); setStep(0); }}
              style={{ width: "100%", marginTop: "12px", padding: "12px", background: "transparent", border: "1.5px solid #e0e0e0", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>
              ← Recalcular
            </button>
          </>
        )}

        {/* Navegação */}
        {!showResult && (
          <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                style={{ flex: 1, padding: "12px", background: "transparent", border: "1.5px solid #e0e0e0", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#888", fontFamily: "'DM Sans', sans-serif" }}>
                ← Voltar
              </button>
            )}
            <button onClick={() => step < 2 ? setStep(step + 1) : setShowResult(true)} disabled={!canAdvance}
              style={{ flex: 2, padding: "12px", background: canAdvance ? "#2d7a4a" : "#ddd", border: "none", borderRadius: "8px", cursor: canAdvance ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: "700", color: "#fff", fontFamily: "'DM Sans', sans-serif", transition: "background 0.2s" }}>
              {step < 2 ? "Continuar →" : "Ver meu resultado →"}
            </button>
          </div>
        )}
      </div>

      <p style={{ marginTop: "20px", fontSize: "11px", color: "#ccc", textAlign: "center" }}>
        Calculadora desenvolvida pelo Método Negócio Essencial® · ML Academy · @marcelalamastra
      </p>
    </div>
  );
}
