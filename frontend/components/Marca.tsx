import Image from "next/image";

export default function Marca({ tamanho = "normal" }: { tamanho?: "normal" | "grande" }) {
  return (
    <div className={`marca ${tamanho === "grande" ? "marca-grande" : ""}`}>
      <Image src="/sesi-logo.png" alt="SESI" width={112} height={39} priority />
      <span className="marca-unidade">Araras</span>
    </div>
  );
}
