# Minha Estante — Catálogo de Livros

Aplicação web estática (HTML, CSS e JavaScript) para catalogar livros, controlar preços e quantidades disponíveis, buscar dados por ISBN/título/autor e escanear códigos de barras ou capas pela câmera.

## Funcionalidades

- **Cadastro e busca**: busque livros por ISBN, título ou autor, ou escaneie o código de barras ISBN com a câmera/foto.
- **Visualização e filtros**: alterne entre visualização em **Capas** ou **Lista**, filtre por disponibilidade (*Todos*, *Disponíveis*, *Esgotados*) e pesquise em tempo real.
- **Backup local**: os dados ficam salvos no `localStorage` do navegador e podem ser exportados/importados em JSON.
- **Sincronização na nuvem (opcional)**: integração com Google Sheets via Google Apps Script.

## Executar localmente

No Windows, execute `abrir-catalogo.bat` (requer Python instalado) para iniciar um servidor local em `http://localhost:8000` e abrir o catálogo no navegador.

## Sincronização com Google Sheets

Para salvar e sincronizar o catálogo em uma planilha do Google:

1. Crie uma planilha no [Google Sheets](https://sheets.google.com).
2. Acesse **Extensões > Apps Script**.
3. Copie o conteúdo de [`google-apps-script.gs`](google-apps-script.gs) para o editor do Apps Script e salve.
4. Clique em **Implantar > Nova implantação**, escolha **App da Web**, defina **Quem pode acessar** como **Qualquer pessoa** e implante.
5. Copie a URL gerada (terminada em `/exec`).
6. No catálogo, clique em **☁️ Nuvem: Local** no topo da página, cole a URL e clique em **Salvar e Sincronizar**.

## GitHub Pages

O projeto é 100% estático e roda diretamente no **GitHub Pages** a partir da branch `main` (diretório raiz `/`). A publicação via HTTPS no GitHub Pages também permite o uso da câmera do dispositivo para leitura de ISBN e captura de capas em celulares e navegadores modernos.
