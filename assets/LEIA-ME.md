# Logo oficial da Divine

Envie aqui o arquivo da logo com o nome exato **`logo.png`**
(fundo branco ou transparente — o processamento converte sozinho).

Como enviar pelo site do GitHub:
1. Abra esta pasta `assets/` no repositório;
2. Clique em **Add file → Upload files**;
3. Arraste o `logo.png`;
4. Clique em **Commit changes** (pode ser direto na `main`).

Depois avise o Claude na sessão — ele roda `editor/processa_logo.py`,
que embute a logo na página publicada, no PowerPoint gerado pelo
editor e no modelo estático da pasta `apresentacao/`.


---

# Foto de capa (opcional)

Para trocar o fundo da capa da apresentação, envie aqui uma foto com o nome
exato **`capa.jpg`** (horizontal, de preferência com um lado mais "limpo"
para o texto). Mesmo processo de upload acima.

Depois avise o Claude — ele roda `editor/processa_capa.py`, que recorta em
16:9, espelha (chocolates para a direita), embute um degradê para o texto
ficar legível e aplica a capa na apresentação. A capa entra só no slide de
capa; os slides de conteúdo seguem limpos para facilitar a leitura.

<!-- redeploy 20260703T182208Z -->

---

# Animação de entrada (opcional)

Arte da animação que toca ao abrir a página:

| Arquivo | O que é |
|---|---|
| `divine-word.png` | A caligrafia "Divine" recortada no traço |
| `divine-tagline.png` | "Chocolate de Verdade", também recortado |

Mesmo processo de upload das imagens acima. Depois avise o Claude — ele roda
`editor/processa_intro.py`, que ajusta a proporção da caligrafia (o
`divine-intro.js` espera 3.1761), recolore a tagline para o dourado da marca e
embute as duas na página como data-URI, mantendo o arquivo único e offline.
