export const DEFAULT_CHAT_MODEL: string = 'gpt-4o';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: '기본적인 GPT-4o 모델',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: '최신버전 GPT-4.1 모델',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: '효율적인 GPT-4o mini 모델',
  },
];
