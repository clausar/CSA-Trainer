# Modo Zen - Sistema de Revisão Espaçada

## Como Funciona

O Modo Zen agora implementa um sistema de revisão espaçada (spaced repetition) inspirado no Anki, mas com uma abordagem contínua e simplificada.

### Mecânica Principal

1. **Acertou a questão** ✅
   - A carta vai para o **fim do baralho**
   - Você verá essa questão novamente depois de passar por todas as outras

2. **Errou a questão** ❌
   - A carta vai para a **posição ~10** (ou 20% do tamanho do baralho)
   - Você verá essa questão novamente em breve para reforçar o aprendizado

3. **Progresso Persistente** 💾
   - O progresso é **automaticamente guardado** quando sai do modo zen
   - Na próxima sessão, continua exatamente de onde parou
   - A ordem do baralho é mantida entre sessões

### Diferenças do Anki

- **Sem intervalos de tempo**: As cartas não "desaparecem" por dias/semanas
- **Fluxo contínuo**: As questões continuam vindo indefinidamente
- **Foco na prática**: Ideal para sessões de estudo contínuas
- **Simples e direto**: Apenas duas posições (fim ou ~10)

### Como Usar

1. **Iniciar Sessão**
   - Clique em "Zen Mode" no menu principal
   - Se é a primeira vez, o baralho é inicializado com todas as questões
   - Se já estudou antes, continua de onde parou

2. **Durante a Sessão**
   - Responda cada questão
   - Veja o feedback imediato (correto/errado)
   - A questão é automaticamente reposicionada no baralho
   - Continue estudando sem limite de tempo

3. **Sair da Sessão**
   - Clique na seta de voltar (←)
   - O progresso é guardado automaticamente
   - Pode voltar a qualquer momento

4. **Resetar Progresso**
   - Vá em Settings → Zen Mode → Reset Zen Deck
   - Isso reinicia o baralho do zero
   - Útil se quiser começar uma nova rodada de estudos

### Vantagens

- ✨ **Foco nas dificuldades**: Questões erradas aparecem mais frequentemente
- 🎯 **Reforço imediato**: Não espera dias para rever erros
- 🔄 **Ciclo infinito**: Perfeito para sessões longas de estudo
- 💪 **Prática constante**: Mantém todas as questões em rotação
- 📊 **Estatísticas**: Acompanhe seu progresso por questão

### Dicas de Estudo

1. **Sessões regulares**: Estude um pouco todos os dias
2. **Foco na compreensão**: Leia as explicações quando errar
3. **Não desista**: Questões difíceis vão aparecer mais até você dominar
4. **Use os filtros**: Configure em Settings para focar em tipos específicos
5. **Acompanhe o progresso**: Veja suas estatísticas por questão no Database

## Implementação Técnica

- **localStorage**: Guarda a ordem do baralho (`csa_zen_deck`)
- **Validação**: Verifica se as cartas ainda existem ao iniciar
- **Sincronização**: Atualiza a ordem após cada resposta
- **Performance**: Usa IDs para referências eficientes
