# 🧠 NeuroSystem - Ecossistema Corporativo Integrado

Bem-vindo ao repositório do **NeuroSystem**, uma solução de intranet modular desenvolvida para otimizar e centralizar os processos internos da **NeuroCenter** (PsicoNeuro).

Este projeto utiliza uma arquitetura de **microsserviços**, onde cada módulo roda de forma independente em sua própria porta, garantindo estabilidade e organização. Todos são conectados a um Portal Central e compartilham uma base de dados unificada.

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow) ![NodeJS](https://img.shields.io/badge/Node.js-v18+-green)

---

## 🚀 Módulos do Sistema

O sistema é dividido em aplicações independentes acessíveis através de um Dashboard único:

### 1. 💬 NeuroChat (Porta 3000)
Sistema de comunicação interna em tempo real.
- **Função:** Substituir mensageiros externos para comunicação segura entre colaboradores.
- **Recursos:** Chat em grupo, mensagens privadas, histórico de conversas e lista de usuários online.

### 2. 🛠️ Suporte TI / HelpDesk (Porta 3001)
Gerenciamento de chamados técnicos e manutenção.
- **Função:** Organizar as solicitações de suporte dos setores para a equipe de TI.
- **Recursos:** Abertura de chamados, classificação por urgência (Baixa/Média/Crítica), painel administrativo e notificações.

### 3. 📅 NeuroAgenda (Porta 3002)
Gestão inteligente de espaços compartilhados.
- **Função:** Evitar conflitos de horário no uso de salas.
- **Recursos:**
  - Agendamento da **Sala de Reuniões** e **NeuroCopa**.
  - Visualização de disponibilidade em grade.
  - Bloqueio administrativo de horários.

### 4. 🚗 NeuroCar (Porta 3003)
Controle de frota e gestão de veículos corporativos.
- **Função:** Monitorar o uso do veículo oficial da empresa.
- **Recursos:**
  - Status visual (Livre/Ocupado) em tempo real.
  - Check-out (Saída) e Check-in (Devolução) com registro de KM.
  - Histórico de uso detalhado.

### 5. 🌐 Portal Corporativo (Frontend Central)
A interface de entrada (Dashboard).
- **Função:** Centralizar o acesso a todos os módulos acima.
- **Design:** Interface moderna com efeito "Glassmorphism", responsiva e com indicadores de status "Online".

---

## 🛠 Tecnologias Utilizadas

* **Backend:** Node.js com Express.
* **Banco de Dados:** MySQL (XAMPP/MariaDB).
* **Frontend:** HTML5, CSS3 (CSS Grid/Flexbox), Javascript Vanilla.
* **Arquitetura:** Microsserviços locais.

---

## ⚙️ Como Rodar o Projeto

### Pré-requisitos
* **Node.js** instalado.
* **MySQL** rodando (XAMPP ou similar).
* Banco de dados `neurochat_db` criado e configurado.

### 1. Instalação
Como o projeto é modular, é necessário instalar as dependências em cada pasta de serviço. Abra o terminal na raiz e execute:

```bash
# Instalar NeuroChat
cd NEUROCHAT
npm install

# Instalar Suporte
cd ../"SUPORTE INTERNO"
npm install

# Instalar Agenda
cd ../NEUROAGENDA
npm install

# Instalar NeuroCar
cd ../NEUROCAR
npm install
