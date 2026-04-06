export const MOCK_SESSIONS = {
  A: {
    description: 'A. Falta de margem + vida defensiva',
    turns: [
      'Sinto que não tenho tempo para nada, estou sempre a correr.',
      'O meu trabalho e a gestão de casa deixam-me esgotada.',
      'Sinto que a minha saúde e energia.', // Cost
      'É mais suportar os dias, faço o mínimo para não cair.', // Mechanism
      'Tenho muito medo de falhar com as pessoas.', // Fear
      'Queria apenas tempo para mim, sem obrigações.' // Desired Life
    ]
  },
  B: {
    description: 'B. Apoio frágil + exaustão',
    turns: [
      'Estou super cansado e sinto-me sozinho a resolver tudo.',
      'Não tenho ninguém com quem dividir as coisas pesadas.',
      'Durmo mal, acordo já exausto.', // Cost
      'Não peço ajuda, finjo que está tudo sob controlo.', // Mechanism
      'Se eu parar, tudo desaba e eu perco o meu lugar.', // Fear
      'Gostava de me poder apoiar em alguém de vez em quando.' // Desired Life
    ]
  },
  C: {
    description: 'C. Vida adiada + perda de direção',
    turns: [
      'Não sei o que estou a fazer com a minha vida.',
      'Sinto-me estagnado, como se os dias repetissem.',
      'A minha alegria de viver desapareceu totalmente.', // Cost
      'Evito pensar nisso vendo séries e a tentar adormecer.', // Mechanism
      'Tenho medo de chegar aos 60 e perceber que não vivi.', // Fear
      'Quero sentir paixão por algo novamente.' // Desired Life
    ]
  },
  D: {
    description: 'D. Mistura difusa / névoa',
    turns: [
      'Nem sei explicar como me sinto...', // Vague
      'Talvez um bocado de tudo.', // Vague
      'Dói-me a cabeça às vezes.', // Cost (fraco)
      'Deixa para lá, acho que toda a gente passa por isto.', // Deflective
      'Não faço ideia do porquê.' // Dont know
    ]
  },
  E: {
    description: 'E. Caso com hipótese rival real a contrastar',
    turns: [
      'Sinto uma pressão no peito enorme no trabalho.',
      'O meu chefe exige imenso, estou no limite.',
      'Levo o stress para casa e isolo-me da família.', // Cost & Mechanism
      'Às vezes penso que talvez o problema nem seja o trabalho, mas a minha relação em casa.', // Rival Hypothesis hint
      'Afinal, tento manter-me no trabalho para evitar o ambiente de casa.', // Contrast clarity
      'Tenho receio de admitir que o casamento falhou.', // Fear
      'Queria paz ao abrir a porta de casa.' // Desired Life
    ]
  }
};
