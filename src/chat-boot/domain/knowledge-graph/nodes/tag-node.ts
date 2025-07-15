import { BaseGraphNode } from './base-graph-node';

export class TagNode extends BaseGraphNode {
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  usageCount: number;

  constructor(data: Partial<TagNode>) {
    super('Tag', data.id);
    Object.assign(this, data);
  }
}
