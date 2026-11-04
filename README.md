<div align="center">

<img src="docs/img/animacao-entrada.jpg" alt="Divine — Chocolate de Verdade" width="100%">

# 🍫 Divine P&D · Acompanhamento de Projetos

**Editor web que organiza o portfólio de novos produtos da Divine Chocolates
e gera, com um clique, a apresentação em PowerPoint da reunião de P&D.**

[![Abrir o editor](https://img.shields.io/badge/▶_Abrir_o_editor-online-E0A33A?style=for-the-badge)](https://oleodias.github.io/divine-example/)
[![Release](https://img.shields.io/badge/versão-v1.0--estável-4A2A1A?style=for-the-badge)](../../releases)

![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![PptxGenJS](https://img.shields.io/badge/PptxGenJS-D24726?logo=microsoftpowerpoint&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222?logo=githubpages&logoColor=white)

</div>

---

## ✨ Sobre o projeto

Antes, cada reunião de acompanhamento exigia montar slides à mão, projeto por projeto.
Agora a equipe de **Pesquisa & Desenvolvimento** preenche um formulário simples no
navegador, e o editor gera uma **apresentação com a identidade visual da Divine**,
com capa, slides por projeto, galeria de fotos, orçamento e animações.

Tudo fica em **um único arquivo HTML**. Não precisa de instalação, servidor nem login,
e funciona até offline.

<div align="center">
<img src="docs/img/editor.jpg" alt="Tela do editor" width="90%">
<br><sub><i>Editor: portfólio à esquerda e formulário do projeto à direita</i></sub>
</div>

---

## 🚀 Funcionalidades

| | Recurso | Detalhes |
|---|---|---|
| 📋 | **Portfólio de projetos** | Crie, duplique, exclua e **reordene arrastando**. A numeração é automática. |
| 🗓️ | **Cronograma de etapas** | Etapas com responsável e prazo. Clique na bolinha para alternar o status. |
| 🚦 | **Status visual** | ✓ Concluído · ◐ Em andamento · ! Bloqueado · ○ Não iniciado |
| 👥 | **Responsáveis** | Lista com as áreas (P&D, Compras, Marketing, Trade, Produção…) e os nomes já usados. |
| 📅 | **Datas automáticas** | Máscara `dd/mm/aaaa` na abertura e "Atualizado em" preenchido sozinho. |
| 📝 | **Pendências e próximas ações** | Uma por linha, já formatadas em tópicos no slide. |
| 💰 | **Orçamento** | Custo estimado × real, fornecedores, aprovação e observações. |
| 🖼️ | **Galeria de fotos** | Layout justificado que **respeita a proporção** de cada imagem, sem distorcer. |
| 🔎 | **Pesquisa de mercado** | Link clicável direto no slide do projeto. |
| ⬇️ | **Gerar PowerPoint** | `.pptx` nativo, editável, com transições *fade* e entradas em cascata. |
| 💾 | **Salvamento automático** | Os dados ficam no navegador. **Exportar/Importar dados** (JSON) serve para backup e para compartilhar. |
| ✨ | **Animação de entrada** | A caligrafia "Divine" desenhada em dourado a cada acesso, com botão **Pular**. |

---

## 🎞️ A apresentação gerada

<table>
<tr>
<td width="50%"><img src="docs/img/slide-1.jpg" alt="Capa"><br><sub><b>Capa:</b> ciclo da reunião e foto da marca</sub></td>
<td width="50%"><img src="docs/img/slide-2.jpg" alt="Status do projeto"><br><sub><b>Projeto:</b> cronograma, pendências e próximas ações</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/img/slide-3.jpg" alt="Imagens e orçamento"><br><sub><b>Imagens e orçamento</b> do produto</sub></td>
<td width="50%"><img src="docs/img/slide-4.jpg" alt="Encerramento"><br><sub><b>Encerramento:</b> agradecimento</sub></td>
</tr>
</table>

---

## 🧭 Como usar

1. Acesse **[oleodias.github.io/divine-example](https://oleodias.github.io/divine-example/)**.
2. Escolha um projeto no **Portfólio** (ou clique em **+ Novo projeto**).
3. Preencha identificação, etapas, pendências, fotos e orçamento.
4. Informe o **Ciclo da reunião** (ex.: *Julho / 2026*), que vai para a capa.
5. Clique em **⬇ Gerar PowerPoint** e pronto!

> 💡 **Dica:** os dados ficam salvos **neste navegador**. Use **Exportar dados** com
> frequência para ter um backup e **Importar dados** para continuar em outro computador.

---

## 🗂️ Estrutura do repositório

```
├── index.html                  ← o editor publicado (GitHub Pages)
├── editor/
│   ├── editor_src.html         ← código-fonte da interface
│   ├── build_editor.js         ← monta o arquivo único Editor_Divine.html
│   ├── divine_export.js        ← gera os slides (layout, galeria, orçamento)
│   ├── divine_anim.js          ← transições e animações do PowerPoint
│   ├── divine-intro.js         ← animação de entrada da página
│   ├── divine_logo.js / divine_capa.js / divine_intro_assets.js  ← imagens embutidas
│   ├── processa_logo.py / processa_capa.py / processa_intro.py   ← preparam as imagens
│   └── migra_dados.py          ← converte backups antigos para o formato atual
├── apresentacao/               ← modelo estático em Python (python-pptx)
├── assets/                     ← arquivos originais da marca (logo, capa, caligrafia)
└── docs/img/                   ← imagens deste README
```

---

## 🛠️ Para desenvolvedores

O editor é escrito em `editor/editor_src.html` e "empacotado" num único HTML,
com bibliotecas, logo e animações embutidas:

```bash
cd editor
npm install pptxgenjs jszip
node build_editor.js            # gera Editor_Divine.html
cp Editor_Divine.html ../index.html
```

Ao publicar na `main`, o **GitHub Pages** atualiza o site automaticamente.
As mudanças entram por *Pull Request* e cada versão estável recebe uma *tag*
(ex.: [`v1.0-estavel`](../../releases)).

---

## 👨‍💻 Desenvolvedor

<div align="center">

<table>
<tr>
<td align="center" width="420">
<br>
<img src="docs/img/assinatura.png" alt="Leonardo Dias" width="300">
<br>
<sub>IDEALIZAÇÃO E DESENVOLVIMENTO</sub>
<br><br>
<a href="https://github.com/oleodias"><img src="https://img.shields.io/badge/GitHub-@oleodias-E0A33A?style=for-the-badge&logo=github&logoColor=white&labelColor=181717" alt="GitHub @oleodias"></a>
<br><br>
</td>
</tr>
</table>

Projeto desenvolvido para a área de **Pesquisa & Desenvolvimento** da **Divine Chocolates**.

<br>
<sub>© 2026 Leonardo Dias</sub>

</div>
