# Instruções para o Claude neste repositório

## Regras de ouro
- **Não quebrar nada que funciona.** Altere só o necessário para o pedido. Na dúvida, pergunte antes.
- **Fluxo obrigatório:** branch nova → commit → Pull Request → merge **só com aprovação do Leonardo**.
  Nunca faça push direto na `main`.
- Converse com o usuário **em português**.

## Boas práticas de Git

### Commits — [Conventional Commits](https://www.conventionalcommits.org/pt-br/)
Formato: `<tipo>(<escopo opcional>): <descrição>`

| Tipo | Quando usar |
|---|---|
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `docs` | documentação (README, guias) |
| `style` | visual/formatação, sem mudar lógica |
| `refactor` | reorganização de código sem mudar comportamento |
| `perf` | desempenho |
| `chore` | manutenção (build, deploy, configuração) |

- Título em português, no **imperativo**, minúsculo, sem ponto final, até **72 caracteres**.
  Ex.: `feat(editor): adiciona campo de fornecedor`, `fix(pptx): corrige proporção das fotos`.
- Corpo (opcional) separado por linha em branco: explica **o quê e por quê**.
- Um commit = uma mudança lógica. Não misture assuntos diferentes.
- Use `git commit -F` quando a mensagem tiver caracteres especiais (ex.: `</script`).

### Branches
- Formato: `<tipo>/<descricao-curta-em-kebab-case>` — ex.: `feat/filtro-por-status`, `fix/datas-capa`, `docs/readme`.
- Sem acentos, espaços ou maiúsculas. Uma branch por assunto.
- O GitHub apaga a branch automaticamente após o merge (opção ativada).

### Pull Requests
- Título no mesmo padrão dos commits.
- Descrição com: **O que muda**, **Por quê** e **Impacto/segurança** (o que NÃO foi alterado).
- Versões estáveis recebem tag/release (`vX.Y-estavel`, ex.: `v1.0-estavel`).

## Arquitetura (resumo)
- `index.html` = cópia do `editor/Editor_Divine.html` gerado. **Nunca edite o `index.html` à mão.**
- Build: `cd editor && npm ci && npm run build` (versões fixadas no `package.json`/`package-lock.json`;
  não use `npm install <pacote>`, que pode trocar a versão das bibliotecas).
- `build_editor.js` embute as bibliotecas e os módulos nos marcadores `<!--PPTXGEN-->`, `<!--EXPORT-->` e `<!--INTRO-->`.
  A função `tag()` escapa `</script` — não remova.
- Dados no `localStorage` + exportar/importar JSON. `migrate()` precisa continuar idempotente.

## Cuidados conhecidos
- `#logoFallback` e `#wmFallback` precisam existir no HTML (usados por `aplicaLogo()`).
- A caligrafia da animação usa proporção **3.1761** (WORD_AR) para pousar no pixel exato do `#logoTop`.
- Animação de entrada: `oncePerSession:false`, `tagTop:0.905`.
- Responsáveis (`RESP_OPCOES`) incluem Trade; valores antigos fora da lista devem ser preservados.
- Antes de abrir PR, gere o build e teste no navegador (abrir a página e gerar o PowerPoint).
