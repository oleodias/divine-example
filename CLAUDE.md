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

## Ponto de retorno (combinado com o Leonardo)
- A tag **`v1.2-estavel`** é a última versão SEM nuvem (GitHub Pages + localStorage + JSON). Nunca apague.
- Se a nuvem der problema: (1) **Exportar dados** no editor; (2) reverter a PR da nuvem
  (botão *Revert* no GitHub); (3) **Importar dados** — o JSON é o mesmo formato da v1.2.
- O formato do JSON de exportação **não pode mudar**: campos auxiliares da nuvem começam com `_`
  e são removidos na exportação, na duplicação e na importação.

## Nuvem (Supabase)
- Projeto `divine-pd` (São Paulo). URL e chave **publicável** ficam em `editor/divine_nuvem.js`.
  A chave secreta/service_role **nunca** entra no código.
- Esquema e regras de segurança: `supabase/schema.sql` (idempotente; rodar no SQL Editor).
- Portfólio da **equipe**: um registro por projeto, `versao` evita sobrescrever edição alheia;
  conflito vira cópia "(sua versão)". Excluir = lixeira (`excluido_em`); só some ao esvaziar.
- Usuários: cadastro público desligado; o admin cria em Authentication → Users → Add user
  (Auto Confirm). Todo usuário criado vira membro (trigger `novo_membro`).
- Modo "só neste computador" continua existindo (chave `divine_editor_v1`); o modo nuvem usa
  `divine_editor_nuvem_v1` como cópia offline.
- O build ajusta o `publicPath` do pacote UMD do supabase-js (ver `build_editor.js`).
- `.github/workflows/supabase-ativo.yml` faz ping 2x/semana para o plano gratuito não pausar.

## Auditoria (histórico)
- Tabela `auditoria`, gravada **só pelo banco** (gatilhos `audita_projeto`/`audita_config` e a função
  `registrar_evento`). A equipe só lê; ninguém edita/apaga pelo editor. Guardada para sempre.
- Registra: criou, editou (com "de → para" por campo e por etapa), excluiu, restaurou, apagou de vez,
  ciclo da capa, PowerPoint gerado, importação e motivo.
- **Motivo obrigatório** ao pausar/cancelar no modo nuvem (sem motivo, o status volta ao anterior).
- Eventos do editor ficam numa fila no `divine_nuvem_meta` (funciona offline) e são descartados ao
  sair da conta, para nunca serem enviados no nome de outra pessoa.
- Para valer, cada pessoa precisa usar o **próprio login**.

## Cuidados conhecidos
- `#logoFallback` e `#wmFallback` precisam existir no HTML (usados por `aplicaLogo()`).
- A caligrafia da animação usa proporção **3.1761** (WORD_AR) para pousar no pixel exato do `#logoTop`.
- Animação de entrada: `oncePerSession:false`, `tagTop:0.905`.
- Responsáveis (`RESP_OPCOES`) incluem Trade; valores antigos fora da lista devem ser preservados.
- Antes de abrir PR, gere o build e teste no navegador (abrir a página e gerar o PowerPoint).
