# Dora — Do Routine Adaptively

> Trabalho de Conclusão de Curso (TCC) — MVP desenvolvido com Next.js

**Dora** (_Do Routine Adaptively_) é um assistente pessoal de produtividade que aprende com o comportamento do usuário ao longo do tempo usando **Q-Learning** (Aprendizado por Reforço) e **GPT-4o-mini** para gerar rotinas completamente personalizadas.

---

## Visão Geral

O sistema permite que o usuário descreva sua rotina em linguagem natural. A IA interpreta essa descrição, cria atividades personalizadas e uma agenda semanal. A cada interação — completar, adiar ou rejeitar uma atividade — o modelo Q-Learning ajusta os pesos e passa a recomendar melhor no futuro.

---

## Funcionalidades

- **Onboarding via GPT-4o-mini**: o usuário descreve sua rotina em texto livre e o modelo gera atividades personalizadas + agenda semanal diferenciada por dia
- **Recomendação diária por Q-Learning**: sugere as melhores atividades com base no estado atual `(dia da semana, bloco horário, nível de energia)`
- **Feedback de atividades**: o usuário informa se completou, adiou, completou parcialmente ou rejeitou cada atividade — o Q-Value é atualizado em tempo real
- **Alternativas inteligentes**: ao ajustar uma atividade, o sistema sugere opções com Q-Values mais altos para aquele contexto
- **Visão semanal**: calendário visual com todas as atividades distribuídas nos 7 dias da semana (grid por hora)
- **Simulador de treinamento**: página que simula N episódios de Q-Learning e plota a curva de convergência dos Q-Values
- **Autenticação com Google** (NextAuth v5 + Prisma Adapter)
- **Streak e estatísticas** de adesão semanal

---

## Arquitetura

```
src/
├── components/          # Componentes reutilizáveis (BottomNav, SuggestionCard, etc.)
├── lib/
│   ├── qlearning.ts     # Núcleo do Q-Learning: estados, ações, recompensas, update
│   ├── auth.ts          # NextAuth com provider Google
│   └── db.ts            # Instância singleton do Prisma Client
├── pages/
│   ├── index.tsx        # Login
│   ├── dashboard/       # Dashboard diário com recomendações
│   ├── semana.tsx       # Visão semanal (grid de calendário)
│   ├── simulate.tsx     # Simulador de treinamento Q-Learning
│   ├── onboarding/
│   │   └── descricao.tsx  # Único passo do onboarding: descrição livre da rotina
│   └── api/
│       ├── feedback.ts          # POST — registra feedback e atualiza Q-Value
│       ├── recommend/daily.ts   # GET — retorna atividades recomendadas para hoje
│       ├── weekly.ts            # GET — retorna agenda da semana inteira
│       ├── simulate.ts          # POST — simula episódios de Q-Learning
│       ├── model.ts             # GET — retorna o modelo Q do usuário
│       └── onboarding/gpt.ts    # POST — processa rotina com GPT e inicializa Q-Values
```

---

## Como o Q-Learning funciona

O estado é representado como uma tupla `(dia_semana, bloco_horario, nivel_energia)`:

| Componente   | Valores possíveis                           |
| ------------ | ------------------------------------------- |
| `dia_semana` | `0` (Segunda) … `6` (Domingo)               |
| `bloco_hora` | `0` Manhã (6h–12h) · `1` Tarde · `2` Noite  |
| `energia`    | `1` (baixa) … `5` (alta)                    |

**Recompensas:**

| Feedback        | Recompensa |
| --------------- | ---------- |
| Completou       | `+10`      |
| Parcialmente    | `+3`       |
| Adiou / Ignorou | `−1`       |
| Rejeitou        | `−5`       |

**Atualização (Q-Learning padrão):**

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \cdot \max_{a'} Q(s, a') - Q(s, a) \right]$$

Com $\alpha = 0.1$ e $\gamma = 0.9$.

---

## Stack Tecnológica

| Camada         | Tecnologia                                             |
| -------------- | ------------------------------------------------------ |
| Framework      | [Next.js 16](https://nextjs.org/) (Pages Router)       |
| Linguagem      | TypeScript 5                                           |
| Banco de dados | PostgreSQL + [Prisma ORM](https://prisma.io/)          |
| Autenticação   | [NextAuth.js v5](https://authjs.dev/) + Google         |
| IA Generativa  | [OpenAI GPT-4o-mini](https://openai.com/)              |
| Estilos        | [Tailwind CSS v4](https://tailwindcss.com/)            |
| Ícones         | Material Symbols

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- PostgreSQL rodando localmente (ou Supabase/Neon)
- Conta Google para OAuth
- Chave de API da OpenAI

### 1. Clone e instale as dependências

```bash
git clone https://github.com/seu-usuario/mvp-next.git
cd mvp-next
npm install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/rotinia"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="seu-secret-aleatorio"

GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-client-secret"

OPENAI_API_KEY="sk-..."
```

### 3. Aplique o schema no banco

```bash
npm run db:push
```

### 4. Rode o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## Fluxo da Aplicação

```
Login (Google)
    └─► Onboarding
          └─ Descrição livre da rotina → GPT gera atividades + agenda semanal
                └─► Dashboard Diário
                      ├─ Recomendações por Q-Learning
                      ├─ Feedback por atividade (atualiza Q-Values)
                      ├─ Alternativas inteligentes
                      └─► Visão Semanal (calendário)
                      └─► Simulador de treinamento
```

---

## Licença

Este projeto foi desenvolvido como MVP de Trabalho de Conclusão de Curso e é de uso acadêmico.
