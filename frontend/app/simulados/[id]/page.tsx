"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listarSimulados, SimuladoResumo } from "@/lib/api";
import { lerSessao } from "@/lib/session";

export default function InstrucoesSimuladoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [simulado, setSimulado] = useState<SimuladoResumo | null>(null);

  useEffect(() => {
    const sessao = lerSessao();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    listarSimulados(sessao.token).then((lista) => {
      const encontrado = lista.find((s) => s.id === Number(params.id));
      if (!encontrado) {
        router.replace("/simulados");
        return;
      }
      setSimulado(encontrado);
    });
  }, [params.id, router]);

  if (!simulado) return null;

  return (
    <div className="tela-boas-vindas">
      <div className="cartao">
        <h1>{simulado.titulo}</h1>
        <p className="subtitulo">Leia com atenção antes de começar.</p>

        <ul style={{ fontSize: 16, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Você terá <strong>{simulado.tempo_limite_min} minutos</strong> para responder.</li>
          <li>Uma questão aparece por vez na tela.</li>
          <li>Você pode marcar uma questão para revisar depois.</li>
          <li>Ao terminar, confirme o envio — depois disso não dá para mudar as respostas.</li>
        </ul>

        <button
          className="botao-primario"
          onClick={() => router.push(`/simulados/${simulado.id}/prova`)}
        >
          Começar simulado
        </button>
      </div>
    </div>
  );
}
