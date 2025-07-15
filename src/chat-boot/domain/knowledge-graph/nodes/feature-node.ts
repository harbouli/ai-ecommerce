import { BaseGraphNode } from './base-graph-node';

export class FeatureNode extends BaseGraphNode {
  name: string;
  description?: string;
  featureType: 'specification' | 'benefit' | 'attribute' | 'tag';
  value?: string;
  unit?: string;
  isFilterable: boolean;
  displayOrder: number;

  constructor(data: Partial<FeatureNode>) {
    super('Feature', data.id);
    Object.assign(this, data);
  }
}
