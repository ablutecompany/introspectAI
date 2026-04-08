import type { FrictionArea, ImmediateGoal } from '../types/internalState';

export const MAPA_LATENTE: Record<Exclude<FrictionArea, 'G'>, { base: string, tension: [string, string], cost: string }> = {
  A: {
    base: 'desgaste e vigilância ativa do corpo',
    tension: ['o desconforto sentido', 'a necessidade absoluta de segurança imediata'],
    cost: 'toda a energia seja gasta a monitorizar riscos em vez de recuperar'
  },
  B: {
    base: 'uma exaustão invisível e normalizada',
    tension: ['a exigência diária constante', 'a tua capacidade real de resposta'],
    cost: 'o cansaço passe a ser visto como uma falha pessoal e não como um limite do sistema'
  },
  C: {
    base: 'um excesso de ativação e saturação',
    tension: ['a tentativa mental de controlar tudo', 'o grau de incerteza da situação'],
    cost: 'o próprio esforço para ter clareza seja o que gera mais bloqueio'
  },
  D: {
    base: 'um sistema pessoal completamente sobrecarregado',
    tension: ['o volume avassalador de coisas', 'o espaço mental para as absorver'],
    cost: 'a desorganização pura comece a pesar na tua identidade e paz de espírito'
  },
  E: {
    base: 'uma tensão de fundo no vínculo',
    tension: ['a necessidade profunda de ser visto', 'o instinto automático de defesa'],
    cost: 'o foco vá todo para a fricção e se perca a bússola daquilo de onde vem a dor'
  },
  F: {
    base: 'um desalinhamento de eixo ou sentido',
    tension: ['a vida que está a ser vivida de facto', 'aquilo que verdadeiramente faria sentido'],
    cost: 'fiques paralisado por sentires que tens de descobrir uma resposta gigante de uma vez'
  }
};

export const MAPA_ORIENTACAO: Record<Exclude<FrictionArea, 'G'>, { avoid_now: string, repositioning: string, distinction: [string, string], micro_step: string }> = {
  A: {
    avoid_now: 'entrar já numa espiral de interpretação sobre o que cada sinal significa',
    repositioning: 'não tratar isto apenas como uma falha da "máquina" a ser corrigida à força',
    distinction: ['a sensação física real', 'a preocupação do que ela significa'],
    micro_step: 'mapear de fora quando é que aperta mais e o que aconteceu logo antes'
  },
  B: {
    avoid_now: 'confundires esta quebra energética com falta de disciplina',
    repositioning: 'reconhecer que o sistema está a pedir mais contenção do que esforço',
    distinction: ['o cansaço puro', 'a total ausência de janelas de recuperação reais'],
    micro_step: 'identificar claramente quando ocorre a maior quebra do dia e proteger essa janela'
  },
  C: {
    avoid_now: 'tentar pensar mais, e com mais força, para sair da própria confusão',
    repositioning: 'lidar com o nevoeiro como efeito de saturação e não como incapacidade tua',
    distinction: ['a ameaça concreta e objetiva', 'o ruído de antecipação e projeção'],
    micro_step: 'registar no papel o que é um facto hoje e o que é apenas amplificação a tentar adivinhar o amanhã'
  },
  D: {
    avoid_now: 'moralizar a desorganização ou adotar métodos radicais imediatos',
    repositioning: 'ver o caos como sinal de que o cesto rebentou pelo peso, não pela qualidade do cesto',
    distinction: ['o que é excesso objetivo de tarefas', 'o que já é apenas a paralisia perfeitamente normal da sobrecarga'],
    micro_step: 'reduzir o campo visual e decidir apenas e só o próximo pequeno ponto de controlo real'
  },
  E: {
    avoid_now: 'precipitar qualquer confronto rotura ou discurso inflamado, pelo menos para já',
    repositioning: 'reconhecer que a dor relacional está a afetar-te em mais domínios',
    distinction: ['o que de facto aconteceu hoje', 'tudo o que o impacto disso te faz sentir'],
    micro_step: 'nomear para ti mesmo se o que dói agora é percecionar distância, desvalorização ou incompreensão'
  },
  F: {
    avoid_now: 'exigir a ti próprio uma resposta ou decisão vital nas próximas horas',
    repositioning: 'aceitar olhar para a pressão de escolher sem tentar arrancar logo a escolha',
    distinction: ['a dificuldade concreta sobre uma direção', 'o peso exagerado em como essa direção tem de definir tudo'],
    micro_step: 'apontar o que te parece ainda ter alguma vida e o que, efetivamente, está estagnado e em peso morto'
  }
};

export const MODULADORES_OBJETIVO: Record<ImmediateGoal, string> = {
  A: 'Focando estritamente em garantir de imediato a redução de atrito antes de tentar arrancar análises pesadas.',
  B: 'Tirando pressão a ter que resolver amanhã, focando só em olhar a situação de cima com alguma calma.',
  C: 'Blindando os teus limites para repor chão debaixo dos pés e recuperar resiliência básica.',
  D: 'Tratando disto com um pragmatismo relacional contido, sem precipitações.',
  E: 'Limpando parte do lixo e da interferência para ficar um pequeno espaço neutro por onde pegar.',
  F: 'Mantendo o passo contido à velocidade do que é possível digerir sem saturar o que já está trancado.'
};

/** Função pura para madlib do LATENTE */
export function buildLatentText(mode: 'MODE_STANDARD' | 'MODE_PROVISIONAL' | 'MODE_EARLY_CLOSE', surfaceTheme: string, latentData: any, secondaryAreaLabel: string | null): string {
  const surface = surfaceTheme.toLowerCase();
  
  if (mode === 'MODE_EARLY_CLOSE') {
    return `Mesmo fechando sem puxar muito, isto parece tocar numa tensão sensível entre ${latentData.tension[0]} e ${latentData.tension[1]}.`;
  }

  if (mode === 'MODE_PROVISIONAL') {
    return `Mesmo com poucos dados estritos, isto não soa totalmente simples. Pode haver aqui mais do que a zona de ${surface}, sobretudo numa tensão profunda entre ${latentData.tension[0]} e ${latentData.tension[1]}. O risco de não olhar para isto é que ${latentData.cost}.`;
  }

  // STANDARD
  let str = `Isto pode não estar a pesar só como a típica questão de ${surface}. Há sinais de que pode também estar em jogo ${latentData.base}. `;
  if (secondaryAreaLabel) {
    str += `E embora se manifeste aqui, começa subtilmente a tocar também na área de ${secondaryAreaLabel}. `;
  }
  str += `O ponto de tensão central parece balançar entre ${latentData.tension[0]} e ${latentData.tension[1]}. O grande custo invisível nisto é que ${latentData.cost}.`;
  return str;
}

/** Função pura para madlib do GUIDANCE */
export function buildGuidanceText(mode: 'MODE_STANDARD' | 'MODE_PROVISIONAL' | 'MODE_EARLY_CLOSE', guidanceData: any, objectiveLabel: string): string {
  
  if (mode === 'MODE_EARLY_CLOSE') {
    return `Para já, e de forma bem contida: ${objectiveLabel} O mais vital é não misturar ${guidanceData.distinction[0]} com ${guidanceData.distinction[1]}. O teu micro-passo é tentar ${guidanceData.micro_step}.`;
  }

  if (mode === 'MODE_PROVISIONAL') {
    return `Atuando de forma prudente nesta fase cruzada: não convém ${guidanceData.avoid_now}. O foco para arrancar é distinguir ${guidanceData.distinction[0]} de ${guidanceData.distinction[1]}. ${objectiveLabel}`;
  }

  // STANDARD
  return `O meu primeiro convite sobre orientação prática é que tentes ${guidanceData.repositioning}. Aquilo que deves mesmo evitar para já é ${guidanceData.avoid_now}. Convém que comeces ativamente a separar ${guidanceData.distinction[0]} de ${guidanceData.distinction[1]}. ${objectiveLabel} Como micro-passo prático esta semana? Tenta ativamente ${guidanceData.micro_step}.`;
}

/** Fecho */
export function buildClosingLine(): string {
  return "Faz este mapeamento para ti. Quando tiveres isto afinado e o passo tentado, estarei aqui sem qualquer expectativa de performance, pronto para continuar o nosso alinhamento estrutural.";
}
