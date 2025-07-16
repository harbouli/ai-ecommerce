export class Intent {
  id: string;
  name: string;
  description: string;
  examples: string[];
  entities: string[];
  responses: IntentResponse[];
  confidence: number;
}

export class IntentResponse {
  template: string;
  parameters: string[];
  actions: string[];
}
