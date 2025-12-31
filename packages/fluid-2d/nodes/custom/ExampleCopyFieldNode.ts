/**
 * @package fluid-2d/nodes/custom
 * Example custom node template: copy one field into another.
 *
 * This demonstrates how a plugin can define metadata for a visual editor and
 * create a compute node bound to fields from the FieldRegistry.
 */

import type { ComputeNodeDefinition } from '../../core/ComputeNodeRegistry';
import { createCopyTextureNode } from '../copyTextureNode';

export type CopyFieldNodeConfig = {
    sourceField: string;
    destField: string;
};

export type CopyFieldNodeInstance = {
    compute: any;
    afterRun?: () => void;
};

export const exampleCopyFieldNode: ComputeNodeDefinition<CopyFieldNodeConfig, CopyFieldNodeInstance> = {
    id: 'utility.copyField',
    label: 'Copy Field',
    category: 'utility',
    inputs: [{ id: 'source', label: 'Source', field: 'any' }],
    outputs: [{ id: 'dest', label: 'Destination', field: 'any' }],
    params: [],
    documentation: 'Copies one field texture into another (vec4). For ping-pong destinations, swaps after copy.',
    create: (registry, cfg) => {
        const source = registry.getRead(cfg.sourceField);
        const destDef = registry.getDefinition(cfg.destField);
        if (!destDef) throw new Error(`[exampleCopyFieldNode] Unknown destination field "${cfg.destField}"`);

        const size = registry.getFieldSize(cfg.destField);
        const dest = destDef.pingPong ? registry.getWrite(cfg.destField) : registry.getRead(cfg.destField);
        const node = createCopyTextureNode(source, dest, size.width, size.height);

        return {
            compute: node.compute,
            afterRun: destDef.pingPong ? () => registry.swap(cfg.destField) : undefined,
        };
    },
};

